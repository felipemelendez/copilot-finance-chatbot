/**
 * Supabase Edge Function — `query-chatbot`
 *
 * A Retrieval-Augmented-Generation (RAG) finance chatbot that:
 *  1. Accepts a POST JSON payload `{ question: string }`.
 *  2. Retrieves the user’s most recent chat history from a `chat_history` table
 *     (so the bot can answer follow-ups like “Why did you say …?”).
 *  3. Builds context from a knowledge-base table (`financial_kb`) **plus** the
 *     top-matching rows returned by a `match_documents` RPC.
 *  4. Calls OpenAI Chat Completions to generate a response:
 *        • For *financial* questions → must cite the supplied context rows.
 *        • For *meta* questions about earlier answers → may explain reasoning.
 *  5. Saves the new user + assistant turns back to `chat_history`.
 *
 * ───────────────
 * Environment vars (set in Dashboard → Project Settings → Functions):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  – needed for row-level-security bypass
 *   OPENAI_API_KEY
 * ───────────────
 * SQL helper for `chat_history` (run once):
 *   create table chat_history (
 *     id          bigint generated always as identity primary key,
 *     user_id     uuid    not null,
 *     role        text    not null check (role in ('user','assistant')),
 *     content     text    not null,
 *     created_at  timestamptz default now()
 *   );
 *   create index on chat_history (user_id, created_at);
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────── Environment & singletons ───────────────
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const HISTORY_LIMIT = 10; // assistant turns (→ 20 rows total)
const ALLOW_ORIGIN = "*"; // change to your domain in prod

// ─────────────── Embeddings helper ───────────────
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  return res.data[0].embedding;
}

// ─────────────── Chat-history helpers ───────────────
async function loadHistory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("chat_history")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT * 2); // user+assistant pairs
  if (error) throw error;
  return (data ?? []).reverse(); // oldest → newest
}

async function saveTurn(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  q: string,
  a: string,
) {
  const { error } = await supabase.from("chat_history").insert([
    { user_id: userId, role: "user", content: q },
    { user_id: userId, role: "assistant", content: a },
  ]);
  if (error) throw error;
}

// ─────────────── Context builder ───────────────
async function fetchContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  question: string,
  k = 50,
) {
  // 1) KB formulas
  const { data: defs, error: kbErr } = await supabase
    .from("financial_kb")
    .select("title, content");
  if (kbErr) throw kbErr;
  const kbText = (defs ?? [])
    .map((d) => `**${d.title}**: ${d.content}`)
    .join("\n");

  // 2) Similarity search
  const qvec = await embed(question);
  const { data: rows, error: rowsErr } = await supabase.rpc(
    "match_documents",
    {
      p_user_id: userId,
      query_embedding: qvec,
      match_threshold: 0.0,
      match_count: k,
    },
  );
  if (rowsErr) throw rowsErr;
  const dataText = (rows ?? []).map((r) => r.content).join("\n---\n");

  return [
    "--- FINANCIAL FORMULAS ---",
    kbText,
    "",
    "--- USER DATA ROWS ---",
    dataText,
  ].join("\n");
}

// ─────────────── LLM wrapper ───────────────
async function answer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  question: string,
): Promise<string> {
  const context = await fetchContext(supabase, userId, question);
  const history = await loadHistory(supabase, userId);

  const policy = [
    "You are a senior financial analyst assistant.",
    "For **financial** questions you may ONLY use supplied context.",
    "If missing data, reply exactly:",
    '"I’m a financial assistant and can only provide answers based on the financial data available to me."',
    "For **meta** questions about prior answers you may explain reasoning.",
    "Always cite rows or formulas when giving numbers.",
  ].join(" ");

  const messages = [
    ...history,
    { role: "system", content: policy },
    { role: "system", content: context },
    { role: "user", content: question },
  ] as OpenAI.ChatCompletionMessageParam[];

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0,
    max_tokens: 700,
  });

  return resp.choices[0].message.content.trim();
}

// ─────────────── HTTP entry-point ───────────────
Deno.serve(async (req: Request) => {
  // ── CORS pre-flight ──
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": ALLOW_ORIGIN,
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    // ── Authorization ──
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", ""); // strip prefix if present

    // Per-request Supabase client so RLS sees the caller’s JWT
    const supabase = createClient(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );

    const { data: userObj } = await supabase.auth.getUser(jwt);
    const userId = Deno.env.get("DUMMY_USER_ID") ?? // preferred for demos
      userObj?.user?.id ?? // real auth UID
      "";

    console.log("[REQ] Auth UID =", userObj?.user?.id, "| Using UID =", userId);

    if (!userId) {
      return json({ error: "unauthorized" }, 401);
    }

    // ── Payload ──
    const { question } = await req.json();
    if (typeof question !== "string" || !question.length) {
      return json({ error: 'missing "question" in body' }, 400);
    }

    // ── Generate answer ──
    const assistantReply = await answer(supabase, userId, question);
    await saveTurn(supabase, userId, question, assistantReply);

    return json({ answer: assistantReply });
  } catch (err) {
    console.error("Edge Function error:", err);
    return json({ error: "internal error", detail: err.message }, 500);
  }
});

// Helper to keep headers consistent
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    },
  });
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/query-chatbot' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
