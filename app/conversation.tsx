import { router } from 'expo-router';
import { useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'alex';
  sentAt: Date;
};

const initialMessages: Message[] = [
  {
    id: '1',
    text: 'Welcome to Project Delivered 👋',
    sender: 'alex',
    sentAt: new Date(),
  },
  {
    id: '2',
    text: 'Great to be here.',
    sender: 'me',
    sentAt: new Date(),
  },
];

export default function ConversationScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] =
    useState<Message[]>(initialMessages);

  const sendMessage = () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      text: trimmedMessage,
      sender: 'me',
      sentAt: new Date(),
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      newMessage,
    ]);

    setMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.name}>Alex</Text>
            <Text style={styles.status}>
              Project Delivered
            </Text>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const sentByMe = item.sender === 'me';

            return (
              <View
                style={
                  sentByMe
                    ? styles.sentRow
                    : styles.receivedRow
                }
              >
                <View
                  style={[
                    styles.messageGroup,
                    sentByMe &&
                      styles.messageGroupSent,
                  ]}
                >
                  <View
                    style={
                      sentByMe
                        ? styles.sentBubble
                        : styles.receivedBubble
                    }
                  >
                    <Text
                      style={
                        sentByMe
                          ? styles.sentText
                          : styles.receivedText
                      }
                    >
                      {item.text}
                    </Text>
                  </View>

                  <Text style={styles.timestamp}>
                    {sentByMe ? 'Sent ' : ''}
                    {formatTime(item.sentAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            multiline
          />

          <Pressable
            disabled={!message.trim()}
            style={[
              styles.sendButton,
              !message.trim() &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  screen: {
    flex: 1,
  },

  header: {
    height: 72,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
    backgroundColor: '#FFFFFF',
  },

  backButton: {
    width: 34,
    marginRight: 6,
  },

  backText: {
    fontSize: 38,
    lineHeight: 40,
    color: '#4169E1',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8ECFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4169E1',
  },

  headerText: {
    flex: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#101828',
  },

  status: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
  },

  messageList: {
    paddingHorizontal: 18,
    paddingVertical: 24,
  },

  receivedRow: {
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  sentRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },

  messageGroup: {
    maxWidth: '78%',
    alignItems: 'flex-start',
  },

  messageGroupSent: {
    alignItems: 'flex-end',
  },

  receivedBubble: {
    backgroundColor: '#EAECF0',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
  },

  sentBubble: {
    backgroundColor: '#4169E1',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomRightRadius: 5,
  },

  receivedText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#101828',
  },

  sentText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },

  timestamp: {
    fontSize: 11,
    color: '#98A2B3',
    marginTop: 5,
    paddingHorizontal: 4,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
    backgroundColor: '#FFFFFF',
  },

  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 10,
    fontSize: 16,
    color: '#101828',
    backgroundColor: '#F9FAFB',
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 9,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  sendText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
});