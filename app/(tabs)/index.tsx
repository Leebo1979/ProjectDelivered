import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PRIVATE MESSAGING</Text>

      <Text style={styles.title}>Project Delivered</Text>

      <Text style={styles.subtitle}>
        Conversations that matter, organised and easy to find.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/create-profile')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#F7F8FA',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#4169E1',
    marginBottom: 14,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 19,
    lineHeight: 28,
    color: '#475467',
    marginBottom: 36,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#4169E1',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});