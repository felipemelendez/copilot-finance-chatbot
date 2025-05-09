![app-icon](https://github.com/user-attachments/assets/86190cc2-c4aa-4c1c-96c3-49b4bdd93e1d)

# 🤖 CoPilot Finance Chatbot

**Talk to your finances. Literally.**

This is a mobile app I built with **React Native + Expo** that lets users _speak_ to a finance assistant powered by a Retrieval-Augmented Generation (RAG) backend. Ask about your runway, burn rate, overdue invoices, or ROI—and get accurate, voice-based answers pulled straight from structured financial data.

---

## 🎯 What This App Does

-   Accepts questions via **typed or spoken input**
-   Retrieves relevant facts from a **chunked financial vector index**
-   Uses OpenAI to **generate clear, grounded answers** from those facts
-   Speaks the answers out loud with **Expo Speech**
-   Runs seamlessly on **iOS, Android, and Web**

All questions stay strictly within the financial domain—thanks to a custom Supabase Edge Function that filters context and prevents the model from hallucinating answers outside supplied data.

---

## ⚙️ Why I Built It With Expo + React Native

### With React Native we can do 2 things that native developers **CANNOT** do:

📱 **One codebase, all platforms** — iOS, Android & Web from a single project  
⚡ **Instant updates** — fix bugs or push improvements over-the-air without review delays

Expo gives me tooling to move fast without giving up native capabilities like microphone access, speech synthesis, and background tasks. Building multi-platform voice interfaces has never been this smooth.

---

## 🔒 Why It Doesn't Hallucinate

This isn't ChatGPT with free rein. Every financial answer must:

-   Be grounded in retrieved documents from the RAG engine
-   Cite specific rows or formulas when giving numbers
-   Reply "I don't have that data" when facts are missing

The Supabase Edge Function that handles prompts uses a strict prompt policy and includes only:

-   Top-matching financial facts from a vector index
-   Relevant formulas from the financial knowledge base
-   Limited recent chat history for follow-ups

No facts = no answer. That keeps the assistant trustworthy.

---

## 🧠 Powered by [`rag-finance-engine`](https://github.com/felipemelendez/rag-finance-engine)

The app connects to a backend that transforms every row of financial data—snapshots, transactions, formulas—into its own self-describing fact string and embeds it separately. This lets the assistant:

-   Pull in only the rows needed for a given question
-   Keep the prompt short and focused
-   Avoid vague summaries or irrelevant details

This level of granularity is what makes the whole experience feel more like a calculator than a chatbot.

---

## 🔊 Voice Features

-   Built-in voice recognition (via `expo-speech-recognition`) lets users dictate questions
-   Answers are spoken out loud, with support for:
    -   Voice selection
    -   Pitch and rate customization
    -   Live test phrases like "Testing Pilot AI"

You can fully control the tone and pace of your CoPilot.

---

## 📚 Stack

-   **React Native** via Expo
-   **Supabase** for data, auth, and edge functions
-   **OpenAI** for embeddings + completions
-   **Expo Speech / Speech Recognition** for voice I/O
-   **Custom vector-based retrieval layer** for grounded answers

---

## 🗣 Sample Conversation

**User:** What's my burn rate for April?  
**CoPilot:** In April, your burn rate was 16,500 dollars. This includes rent, payroll, and subscriptions.

**User:** And how much runway do I have?  
**CoPilot:** With a cash balance of 48,000 dollars and a burn rate of 16,500, your current runway is approximately 2.9 months.

---

## 🔍 Focused on Finance—Not a General Chatbot

CoPilot AI is not a general-purpose assistant. It doesn’t generate small talk, explain pop culture, or summarize articles. It stays strictly focused on:

-   Budgets
-   Ratios
-   Balances
-   Cash flow
-   Equity
-   Vendor payments
-   Any fact that can be traced to the database

That constraint makes it reliable in ways traditional LLM interfaces aren’t.

---

## 💡 What I Learned

This project was an experiment in precision + experience:

-   How to make RAG _not suck_ by chunking smart
-   How to speak to your data without feeling like you're talking to a toy
-   How to make voice interfaces feel instant and useful
-   How to keep answers auditable and clean

---

## 🔜 Next Steps

-   Visual charts and data overlays
-   Better handling of follow-up questions
-   Push alerts for threshold-based financial triggers
-   User history insights and natural summaries

---

Want to learn how the backend works? Check out: [rag-finance-engine](https://github.com/felipemelendez/rag-finance-engine)
