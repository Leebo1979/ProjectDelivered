import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ChatsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PROJECT DELIVERED</Text>
            <Text style={styles.title}>Chats</Text>
          </View>

          <Pressable style={styles.newChatButton}>
            <Text style={styles.newChatText}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>RECENT</Text>

        <Pressable
          style={styles.chat}
          onPress={() => router.push('/conversation')}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatTopRow}>
              <Text style={styles.name}>Alex</Text>
              <Text style={styles.time}>Now</Text>
            </View>

            <Text style={styles.preview} numberOfLines={1}>
              Welcome to Project Delivered 👋
            </Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#4169E1',
    marginBottom: 6,
  },

  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#101828',
  },

  newChatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newChatText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '400',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#98A2B3',
    marginBottom: 12,
  },

  chat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E8ECFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4169E1',
  },

  chatContent: {
    flex: 1,
  },

  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#101828',
  },

  time: {
    fontSize: 13,
    color: '#98A2B3',
  },

  preview: {
    fontSize: 15,
    color: '#667085',
  },
});