import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { supabase } from '../lib/supabase';

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  const loadConversation = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('User load error:', userError);
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('messages')
        .select('id, body, sender_id, created_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Message load error:', error);
        return;
      }

      setMessages(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || !currentUserId || !conversationId) {
      return;
    }

    try {
      setSending(true);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          body: trimmedMessage,
        })
        .select('id, body, sender_id, created_at')
        .single();

      if (error || !data) {
        console.error('Send message error:', error);
        return;
      }

      setMessages((current) => [...current, data]);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
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
            <Text style={styles.avatarText}>T</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.name}>Test Conversation</Text>
            <Text style={styles.status}>Project Delivered</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator
              size="large"
              color="#4169E1"
            />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => {
              const sentByMe =
                item.sender_id === currentUserId;

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
                        {item.body}
                      </Text>
                    </View>

                    <Text style={styles.timestamp}>
                      {sentByMe ? 'Sent ' : ''}
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

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
            disabled={!message.trim() || sending}
            style={[
              styles.sendButton,
              (!message.trim() || sending) &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
          >
            <Text style={styles.sendText}>
              {sending ? '…' : '↑'}
            </Text>
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

  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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