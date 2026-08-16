import { StyleSheet, Text, View } from 'react-native';

export default function ChatsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PROJECT DELIVERED</Text>

      <Text style={styles.title}>Chats</Text>

      <Text style={styles.subtitle}>
        Your conversations will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
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
    fontSize: 36,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 27,
    color: '#475467',
  },
});