import { FontAwesome5 } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import { ThemedText } from '@/components/ThemedText';
import supabase from '@/src/lib/supabase';

const normalizeCurrencyForSpeech = (raw: string): string =>
    raw.replace(/\$\s*([\d,]+(?:\.\d+)?)/g, (_, num) => `${num} dollars`);

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

const useToggleSuggestions = (
    show: boolean,
    setShow: Dispatch<SetStateAction<boolean>>,
) =>
    useCallback(() => {
        Keyboard.dismiss();
        setShow((prev) => !prev);
    }, [setShow]);

interface ChatDoc {
    title: string;
    url: string;
}
interface ChatMessage {
    message: string;
    isUser: boolean;
    docs?: ChatDoc[];
}
interface PromptResponse {
    answer: string;
    docs?: ChatDoc[];
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

const SUGGESTIONS = [
    'What is my current runway?',
    'What’s my return on equity?',
    'What’s my current cash flow?',
    'What’s my debt-to-equity ratio?',
    'What is my burn rate per month?',
    'How did actual marketing spend compare to budget this quarter?',
    'Do I owe any money to vendors?',
    'What’s my current cash balance?',
    'How much working capital do I have?',
    'What was my net cash flow last month?',
    'Which invoices are overdue, and by how many days?',
];

const TEST_PHRASE = 'Testing Pilot AI';

export default function TabTwoScreen() {
    /* ----------------------------- Local state ----------------------------- */
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [inputBottom, setInputBottom] = useState(50);

    /* --------------------------- Voice recording --------------------------- */
    const [isRecording, setIsRecording] = useState(false);
    const voiceStarted = useRef(false);

    /* --------------------------- Speech control ---------------------------- */
    const [isSpeaking, setIsSpeaking] = useState(false);

    /* --------------------------- Voice options ----------------------------- */
    const [voices, setVoices] = useState<Speech.Voice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(
        null,
    );
    const pitchOptions = [0.9, 1.0, 1.1];
    const rateOptions = [0.9, 1.0, 1.1];
    const [selectedPitch, setSelectedPitch] = useState<number>(1.0);
    const [selectedRate, setSelectedRate] = useState<number>(1.0);

    /* --------------------------- Settings modal --------------------------- */
    const [modalVisible, setModalVisible] = useState(false);

    /* ---------------------- Keyboard show / hide hooks --------------------- */
    useEffect(() => {
        const showEvt =
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt =
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvt, () => setInputBottom(0));
        const hideSub = Keyboard.addListener(hideEvt, () => setInputBottom(50));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    /* ------------------------ Fetch available voices ----------------------- */
    useEffect(() => {
        (async () => {
            try {
                const v = await Speech.getAvailableVoicesAsync();
                const englishVoices =
                    v?.filter((voice) => voice.language.startsWith('en')) ?? [];
                setVoices(englishVoices.length ? englishVoices : v ?? []);
                if (englishVoices.length) {
                    setSelectedVoiceURI(englishVoices[0].identifier);
                }
            } catch (err) {
                console.warn('Unable to fetch voices', err);
            }
        })();
    }, []);

    /* -------------------------- Speech helpers ----------------------------- */
    const speakWithOptions = (
        text: string,
        opts: Partial<Speech.SpeechOptions>,
    ) => {
        if (isSpeaking) {
            Speech.stop();
        }
        setIsSpeaking(true);
        Speech.speak(text, {
            language: 'en-US',
            ...opts,
            onDone: () => setIsSpeaking(false),
            onStopped: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
        });
    };

    const speakAnswer = (text: string) => {
        const cleaned = normalizeCurrencyForSpeech(text);
        speakWithOptions(cleaned, {
            voice: selectedVoiceURI ?? undefined,
            pitch: selectedPitch,
            rate: selectedRate,
        });
    };

    const testSpeak = (
        voice: string | null = selectedVoiceURI,
        pitch = selectedPitch,
        rate = selectedRate,
    ) => {
        speakWithOptions(TEST_PHRASE, {
            voice: voice ?? undefined,
            pitch,
            rate,
        });
    };

    const stopSpeaking = () => {
        if (isSpeaking) {
            Speech.stop();
            setIsSpeaking(false);
        }
    };

    /* --------------------- Speech-to-text event listeners ------------------ */
    useSpeechRecognitionEvent('result', (e) => {
        const txt = e.results[0]?.transcript ?? '';
        setQuery(txt);
    });
    useSpeechRecognitionEvent('end', () => {
        setIsRecording(false);
        voiceStarted.current = false;
    });

    const startRecording = async () => {
        if (voiceStarted.current) return;
        const { granted } =
            await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) {
            console.warn('Speech permission not granted');
            return;
        }
        try {
            await ExpoSpeechRecognitionModule.start({
                lang: 'en-US',
                interimResults: false,
                continuous: false,
            });
            setIsRecording(true);
            voiceStarted.current = true;
        } catch (err) {
            console.warn('Speech start error', err);
        }
    };

    const stopRecording = async () => {
        try {
            await ExpoSpeechRecognitionModule.stop();
        } catch (err) {
            console.warn('Speech stop error', err);
        }
    };

    /* ---------------------------- Send prompt ----------------------------- */
    const runPrompt = async (text?: string) => {
        const promptText = (text ?? query).trim();
        if (!promptText) return;

        stopSpeaking();
        setShowSuggestions(false);
        setMessages((curr) => [{ message: promptText, isUser: true }, ...curr]);
        setQuery('');
        Keyboard.dismiss();
        setLoading(true);

        const { data, error } = await supabase.functions.invoke<PromptResponse>(
            'query-chatbot',
            { body: { question: promptText } },
        );

        setLoading(false);

        if (error) {
            console.error('Supabase invoke failed:', error);
            return;
        }
        if (data) {
            speakAnswer(data.answer);
            setMessages((curr) => [
                { message: data.answer, isUser: false, docs: data.docs },
                ...curr,
            ]);
        }
    };

    const handleSuggestionPress = (suggestion: string) => {
        setQuery(suggestion);
        runPrompt(suggestion);
    };

    /* ------------------------- Settings handlers --------------------------- */
    const handleVoiceSelect = (voiceId: string) => {
        setSelectedVoiceURI(voiceId);
        testSpeak(voiceId);
    };

    const handlePitchSelect = (p: number) => {
        setSelectedPitch(p);
        testSpeak(selectedVoiceURI, p, selectedRate);
    };

    const handleRateSelect = (r: number) => {
        setSelectedRate(r);
        testSpeak(selectedVoiceURI, selectedPitch, r);
    };

    /* ----------------------------- Rendering ------------------------------ */
    const toggleSuggestions = useToggleSuggestions(
        showSuggestions,
        setShowSuggestions,
    );

    const renderItem = ({ item }: { item: ChatMessage }) => (
        <View style={styles.messageWrapper}>
            <ThemedText
                style={[
                    styles.username,
                    item.isUser ? styles.userNameRight : styles.aiNameLeft,
                ]}
            >
                {item.isUser ? 'You' : 'CoPilot AI'}
            </ThemedText>

            <View
                style={[
                    item.isUser
                        ? styles.userMessageContainer
                        : styles.aiMessageContainer,
                    item.isUser ? styles.userMessage : styles.aiMessage,
                ]}
            >
                <Markdown style={{ body: { color: '#2b3043', fontSize: 17 } }}>
                    {item.message}
                </Markdown>

                {item.docs?.length ? (
                    <>
                        <ThemedText style={styles.docsTitle}>
                            Read more:
                        </ThemedText>
                        {item.docs.map((doc) => (
                            <ExternalLink key={doc.url} href={doc.url}>
                                <ThemedText type="link">{doc.title}</ThemedText>
                            </ExternalLink>
                        ))}
                    </>
                ) : null}
            </View>
        </View>
    );

    /* ---------------------------------------------------------------------- */
    /* JSX                                                                    */
    /* ---------------------------------------------------------------------- */

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
            >
                <View style={styles.container}>
                    {/* Settings button (top-left) */}
                    <TouchableOpacity
                        style={styles.settingsBtn}
                        onPress={() => setModalVisible(true)}
                    >
                        <FontAwesome5 name="cog" size={28} color="#5F2EE5" />
                    </TouchableOpacity>

                    {/* Toggle suggestion button (top-right) */}
                    {!showSuggestions && !query.length && (
                        <TouchableOpacity
                            style={styles.toggleBtn}
                            onPress={toggleSuggestions}
                        >
                            <Image
                                source={require('@/assets/images/icon-small.png')}
                                style={styles.toggleIcon}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    )}

                    {/* Placeholder icon */}
                    {messages.length === 0 && (
                        <View style={styles.centeredIconContainer}>
                            <Image
                                source={require('@/assets/images/pilot-p.png')}
                                style={styles.centeredIcon}
                                resizeMode="contain"
                            />
                        </View>
                    )}

                    {/* Messages list */}
                    <FlatList
                        data={messages}
                        inverted
                        keyExtractor={(_, i) => i.toString()}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        renderItem={renderItem}
                    />

                    {/* Suggestions list */}
                    {showSuggestions && (
                        <Collapsible title="Try asking one of these">
                            <View style={styles.suggestionsContainer}>
                                {SUGGESTIONS.map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        style={styles.suggestionChip}
                                        onPress={() => handleSuggestionPress(s)}
                                    >
                                        <ThemedText>{s}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Collapsible>
                    )}

                    {/* Prompt input row */}
                    <View
                        style={[styles.inputRow, { marginBottom: inputBottom }]}
                    >
                        {/* Mic / stop recording button */}
                        <TouchableOpacity
                            style={styles.micButton}
                            onPress={
                                isRecording ? stopRecording : startRecording
                            }
                        >
                            <FontAwesome5
                                name={
                                    isRecording
                                        ? 'microphone-slash'
                                        : 'microphone'
                                }
                                size={25}
                                color={isRecording ? '#ff5252' : '#5F2EE5'}
                            />
                        </TouchableOpacity>

                        {/* Stop speaking button */}
                        {isSpeaking && (
                            <TouchableOpacity
                                style={styles.stopSpeakingButton}
                                onPress={stopSpeaking}
                            >
                                <FontAwesome5
                                    name="stop-circle"
                                    size={30}
                                    color="#ff5252"
                                />
                            </TouchableOpacity>
                        )}

                        <TextInput
                            style={styles.textInput}
                            placeholder="Ask a question"
                            placeholderTextColor="lightgray"
                            selectionColor="#5F2EE5"
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={() => runPrompt()}
                            returnKeyType="send"
                        />

                        {/* Send button */}
                        <TouchableOpacity
                            onPress={() => runPrompt()}
                            style={styles.sendButton}
                        >
                            <FontAwesome5
                                name="arrow-circle-up"
                                size={40}
                                color="#5F2EE5"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Loading overlay */}
                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#5F2EE5" />
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* --------------------------- Settings modal --------------------------- */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPressOut={() => setModalVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>
                            Voice & Speech Settings
                        </ThemedText>

                        <ThemedText style={styles.sectionLabel}>
                            Voice
                        </ThemedText>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.voiceRow}
                        >
                            {voices.map((v) => (
                                <TouchableOpacity
                                    key={v.identifier}
                                    style={[
                                        styles.voiceChip,
                                        v.identifier === selectedVoiceURI &&
                                            styles.voiceChipSelected,
                                    ]}
                                    onPress={() =>
                                        handleVoiceSelect(v.identifier)
                                    }
                                >
                                    <ThemedText>
                                        {v.name.replace(/[-_]/g, ' ')}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <ThemedText style={styles.sectionLabel}>
                            Pitch
                        </ThemedText>
                        <View style={styles.voiceSubRow}>
                            {pitchOptions.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.voiceChipSmall,
                                        p === selectedPitch &&
                                            styles.voiceChipSelected,
                                    ]}
                                    onPress={() => handlePitchSelect(p)}
                                >
                                    <ThemedText>{p.toFixed(1)}</ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <ThemedText style={styles.sectionLabel}>
                            Rate
                        </ThemedText>
                        <View style={styles.voiceSubRow}>
                            {rateOptions.map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={[
                                        styles.voiceChipSmall,
                                        r === selectedRate &&
                                            styles.voiceChipSelected,
                                    ]}
                                    onPress={() => handleRateSelect(r)}
                                >
                                    <ThemedText>{r.toFixed(1)}</ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    settingsBtn: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 6,
        padding: 8,
    },
    listContainer: {
        gap: 10,
        paddingBottom: 100,
    },
    centeredIconContainer: {
        position: 'absolute',
        top: '20%',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: -1,
    },
    centeredIcon: {
        width: 100,
        height: 100,
    },
    messageWrapper: {},
    username: {
        fontWeight: '700',
        marginBottom: 5,
    },
    userNameRight: {
        textAlign: 'right',
        color: '#2b3043',
    },
    aiNameLeft: {
        textAlign: 'left',
        color: '#5F2EE5',
    },
    userMessageContainer: {
        maxWidth: '100%',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
        borderBottomEndRadius: 0,
        borderWidth: 1,
        borderColor: '#d7ddef',
    },
    aiMessageContainer: {
        maxWidth: '100%',
        paddingHorizontal: 10,
        paddingVertical: 3,
        paddingBottom: 20,
        borderRadius: 8,
        borderBottomStartRadius: 0,
        borderWidth: 1,
        borderColor: '#5F2EE520',
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#d7ddef70',
        marginLeft: 40,
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#5F2EE510',
        marginRight: 40,
    },
    docsTitle: {
        fontWeight: 'bold',
        paddingTop: 10,
        color: '#5d6885',
    },
    suggestionsContainer: {
        alignSelf: 'flex-start',
    },
    suggestionChip: {
        backgroundColor: '#5F2EE520',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 7,
        borderBottomStartRadius: 0,
        marginBottom: 10,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#5F2EE550',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 50,
    },
    textInput: {
        flex: 1,
        fontSize: 18,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderColor: 'gainsboro',
        borderWidth: 1,
        borderRadius: 50,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 5,
    },
    toggleIcon: {
        width: 40,
        height: 40,
    },
    sendButton: {
        backgroundColor: 'white',
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    micButton: {
        backgroundColor: 'white',
        borderRadius: 50,
        padding: 8,
        borderWidth: 1,
        borderColor: '#d7ddef',
    },
    stopSpeakingButton: {
        backgroundColor: 'white',
        borderRadius: 50,
        padding: 4,
        borderWidth: 1,
        borderColor: '#ffb3b3',
    },
    /* ---------- Modal styles ---------- */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 10,
        textAlign: 'center',
    },
    sectionLabel: {
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 4,
    },
    voiceRow: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: 8,
        paddingVertical: 8,
    },
    voiceChip: {
        backgroundColor: '#5F2EE520',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#5F2EE550',
    },
    voiceChipSelected: {
        backgroundColor: '#5F2EE5',
        borderColor: '#5F2EE5',
    },
    voiceSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    voiceChipSmall: {
        backgroundColor: '#5F2EE520',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#5F2EE550',
    },
});
