import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

type OtherUser = {
  display_name: string;
  username: string;
};

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [otherUser, setOtherUser] =
    useState<OtherUser | null>(null);

  const [conversationTitle, setConversationTitle] =
    useState('Conversation');

  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    loadConversation();

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setMessages((currentMessages) => {
            const alreadyExists =
              currentMessages.some(
                (item) =>
                  item.id === newMessage.id
              );

            if (alreadyExists) {
              return currentMessages;
            }

            return [
              ...currentMessages,
              newMessage,
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const loadConversation = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          'User load error:',
          userError
        );
        return;
      }

      setCurrentUserId(user.id);

      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select(
          'id, title, is_group'
        )
        .eq('id', conversationId)
        .single();

      if (conversationError) {
        console.error(
          'Conversation load error:',
          conversationError
        );
      }

      if (conversation) {
        if (conversation.is_group) {
          setConversationTitle(
            conversation.title ??
              'Group Conversation'
          );
        } else {
          const {
            data: members,
            error: membersError,
          } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq(
              'conversation_id',
              conversationId
            );

          if (membersError) {
            console.error(
              'Members load error:',
              membersError
            );
          } else {
            const otherMember =
              members?.find(
                (member) =>
                  member.user_id !== user.id
              );

            if (otherMember) {
              const {
                data: profile,
                error: profileError,
              } = await supabase
                .from('profiles')
                .select(
                  'display_name, username'
                )
                .eq(
                  'id',
                  otherMember.user_id
                )
                .maybeSingle();

              if (profileError) {
                console.error(
                  'Profile load error:',
                  profileError
                );
              }

              if (profile) {
                setOtherUser(profile);
                setConversationTitle(
                  profile.display_name
                );
              }
            } else {
              setConversationTitle(
                conversation.title ??
                  'Conversation'
              );
            }
          }
        }
      }

      const { data, error } = await supabase
        .from('messages')
        .select(
          'id, body, sender_id, created_at'
        )
        .eq(
          'conversation_id',
          conversationId
        )
        .is('deleted_at', null)
        .order('created_at', {
          ascending: true,
        });

      if (error) {
        console.error(
          'Message load error:',
          error
        );
        return;
      }

      setMessages(data ?? []);
    } catch (error) {
      console.error(
        'Conversation load error:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const trimmedMessage =
      message.trim();

    if (
      !trimmedMessage ||
      !currentUserId ||
      !conversationId ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id:
            conversationId,
          sender_id: currentUserId,
          body: trimmedMessage,
        })
        .select(
          'id, body, sender_id, created_at'
        )
        .single();

      if (error || !data) {
        console.error(
          'Send message error:',
          error
        );
        return;
      }

      setMessages(
        (currentMessages) => {
          const alreadyExists =
            currentMessages.some(
              (item) =>
                item.id === data.id
            );

          if (alreadyExists) {
            return currentMessages;
          }

          return [
            ...currentMessages,
            data,
          ];
        }
      );

      setMessage('');
    } catch (error) {
      console.error(
        'Send message error:',
        error
      );
    } finally {
      setSending(false);
    }
  };

  const formatTime = (
    timestamp: string
  ) => {
    return new Date(
      timestamp
    ).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text
              style={styles.backText}
            >
              ‹
            </Text>
          </Pressable>

          <View style={styles.avatar}>
            <Text
              style={styles.avatarText}
            >
              {conversationTitle
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View
            style={styles.headerText}
          >
            <Text style={styles.name}>
              {conversationTitle}
            </Text>

            <Text style={styles.status}>
              {otherUser
                ? `@${otherUser.username}`
                : 'Live'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View
            style={
              styles.loaderContainer
            }
          >
            <ActivityIndicator
              size="large"
              color="#4169E1"
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) =>
              item.id
            }
            contentContainerStyle={
              styles.messageList
            }
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({
                animated: false,
              })
            }
            renderItem={({ item }) => {
              const sentByMe =
                item.sender_id ===
                currentUserId;

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

                    <Text
                      style={
                        styles.timestamp
                      }
                    >
                      {sentByMe
                        ? 'Sent '
                        : ''}
                      {formatTime(
                        item.created_at
                      )}
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
            disabled={
              !message.trim() ||
              sending
            }
            style={[
              styles.sendButton,
              (!message.trim() ||
                sending) &&
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