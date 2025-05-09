import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: '#d7ddef', dark: '#1D3D47' }}
            headerImage={
                <Image
                    source={require('@/assets/images/pilot-logo.png')}
                    style={styles.reactLogo}
                />
            }
        >
            <ThemedView style={styles.titleContainer}>
                <ThemedText type="title">Welcome to PilotAI</ThemedText>
                <HelloWave />
            </ThemedView>
            <ThemedView style={styles.stepContainer}>
                <ThemedText type="subtitle">
                    Step 1: Meet your AI CoPilot
                </ThemedText>
                <ThemedText>
                    In the <ThemedText type="defaultSemiBold">Chat</ThemedText>{' '}
                    tab, you can ask questions about your business finances—like
                    your runway, spending this month, or what might need your
                    attention.
                </ThemedText>
            </ThemedView>
            <ThemedView style={styles.stepContainer}>
                <ThemedText type="subtitle">Step 2: Stay focused</ThemedText>
                <ThemedText>
                    This AI is designed to help you understand your books. It
                    won’t answer unrelated questions—just insights about your
                    business.
                </ThemedText>
            </ThemedView>
            <ThemedView style={styles.stepContainer}>
                <ThemedText type="subtitle">
                    Step 3: You&#39;re all set
                </ThemedText>
                <ThemedText>
                    Enjoy exploring your finances with your AI Copilot! If you
                    ever have questions or feedback, we’d love to hear from you
                    at <ThemedText type="defaultSemiBold">pilot.com</ThemedText>
                </ThemedText>
            </ThemedView>
        </ParallaxScrollView>
    );
}

const styles = StyleSheet.create({
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    reactLogo: {
        height: 178,
        width: 350,
        resizeMode: 'contain',
        alignSelf: 'center',
        marginTop: 70,
    },
});
