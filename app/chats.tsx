import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

const ONBOARDING_KEY = 'project_delivered_onboarding_complete';
const BIOMETRICS_KEY = 'project_delivered_biometrics_enabled';
const PIN_STORAGE_KEY = 'project_delivered_pin';

type ConversationRow = {
  id: string;
  title: string | null;
  is_group: boolean;
  created_at: string;
};

type ChatListItem = {
  id: string;
  displayName: string;
  username: string | null;
  latestMessage: string;
  latestMessageAt: string | null;
  isGroup: boolean;
};

export default function ChatsScreen() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const loadChats = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Not signed in',
          'Project Delivered could not find your account session.'
        );
        return;
      }

      const { data: memberships, error: membershipError } =
        await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', user.id);

      if (membershipError) {
        Alert.alert(
          'Unable to load chats',
          membershipError.message
        );
        return;
      }

      const conversationIds =
        memberships?.map(
          (item) => item.conversation_id
        ) ?? [];

      if (conversationIds.length === 0) {
        setChats([]);
        return;
      }

      const { data: conversations, error: conversationError } =
        await supabase
          .from('conversations')
          .select(
            'id, title, is_group, created_at'
          )
          .in('id', conversationIds);

      if (conversationError) {
        Alert.alert(
          'Unable to load chats',
          conversationError.message
        );
        return;
      }

      const chatItems = await Promise.all(
        (conversations as ConversationRow[]).map(
          async (conversation) => {
            let displayName =
              conversation.title ?? 'Conversation';

            let username: string | null = null;

            if (!conversation.is_group) {
              const {
                data: memberRows,
                error: membersError,
              } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq(
                  'conversation_id',
                  conversation.id
                );

              if (!membersError) {
                const otherMember =
                  memberRows?.find(
                    (member) =>
                      member.user_id !== user.id
                  );

                if (otherMember) {
                  const {
                    data: otherProfile,
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

                  if (otherProfile) {
                    displayName =
                      otherProfile.display_name;

                    username =
                      otherProfile.username;
                  }
                }
              }
            }

            const {
              data: latestMessageRows,
            } = await supabase
              .from('messages')
              .select('body, created_at')
              .eq(
                'conversation_id',
                conversation.id
              )
              .is('deleted_at', null)
              .order('created_at', {
                ascending: false,
              })
              .limit(1);

            const latestMessage =
              latestMessageRows?.[0];

            return {
              id: conversation.id,
              displayName,
              username,
              latestMessage:
                latestMessage?.body ??
                'No messages yet',
              latestMessageAt:
                latestMessage?.created_at ??
                conversation.created_at,
              isGroup:
                conversation.is_group,
            };
          }
        )
      );

      chatItems.sort((a, b) => {
        const aTime = a.latestMessageAt
          ? new Date(a.latestMessageAt).getTime()
          : 0;

        const bTime = b.latestMessageAt
          ? new Date(b.latestMessageAt).getTime()
          : 0;

        return bTime - aTime;
      });

      setChats(chatItems);
    } catch (error) {
      console.error(
        'Load chats error:',
        error
      );

      Alert.alert(
        'Unable to load chats',
        'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        Alert.alert(
          'Unable to sign out',
          error.message
        );
        return;
      }

      router.replace('/sign-up');
    } catch (error) {
      console.error(
        'Sign out error:',
        error
      );

      Alert.alert(
        'Unable to sign out',
        'Please try again.'
      );
    }
  };

  const resetDevelopmentState =
    async () => {
      try {
        await SecureStore.deleteItemAsync(
          ONBOARDING_KEY
        );

        await SecureStore.deleteItemAsync(
          BIOMETRICS_KEY
        );

        await SecureStore.deleteItemAsync(
          PIN_STORAGE_KEY
        );

        router.replace('/');
      } catch (error) {
        console.error(
          'Reset error:',
          error
        );

        Alert.alert(
          'Reset failed',
          'Project Delivered could not clear the local development state.'
        );
      }
    };

  const formatChatTime = (
    timestamp: string | null
  ) => {
    if (!timestamp) {
      return '';
    }

    const date = new Date(timestamp);
    const now = new Date();

    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (sameDay) {
      return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              PROJECT DELIVERED
            </Text>

            <Text style={styles.title}>
              Chats
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.favouritesButton}
              onPress={() =>
                router.push('/favourites')
              }
            >
              <Text
                style={styles.favouritesText}
              >
                ★
              </Text>
            </Pressable>

            <Pressable
              style={styles.newChatButton}
              onPress={() =>
                router.push('/find-user')
              }
            >
              <Text
                style={styles.newChatText}
              >
                +
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          RECENT
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={styles.loader}
          />
        ) : chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Text
              style={styles.emptyTitle}
            >
              No conversations yet
            </Text>

            <Text
              style={styles.emptyText}
            >
              Tap the + button to find another Project Delivered user.
            </Text>
          </View>
        ) : (
          chats.map((chat) => (
            <Pressable
              key={chat.id}
              style={styles.chat}
              onPress={() =>
                router.push({
                  pathname:
                    '/conversation',
                  params: {
                    conversationId:
                      chat.id,
                  },
                })
              }
            >
              <View style={styles.avatar}>
                <Text
                  style={styles.avatarText}
                >
                  {chat.displayName
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View
                style={styles.chatContent}
              >
                <View
                  style={styles.chatTopRow}
                >
                  <Text
                    style={styles.name}
                    numberOfLines={1}
                  >
                    {chat.displayName}
                  </Text>

                  <Text
                    style={styles.time}
                  >
                    {formatChatTime(
                      chat.latestMessageAt
                    )}
                  </Text>
                </View>

                <View
                  style={styles.previewRow}
                >
                  <Text
                    style={styles.preview}
                    numberOfLines={1}
                  >
                    {chat.latestMessage}
                  </Text>
                </View>

                {chat.username && (
                  <Text
                    style={styles.username}
                  >
                    @{chat.username}
                  </Text>
                )}
              </View>
            </Pressable>
          ))
        )}

        <View
          style={styles.developmentSection}
        >
          <Text
            style={styles.developmentLabel}
          >
            DEVELOPMENT
          </Text>

          <Pressable
            style={styles.devButton}
            onPress={signOut}
          >
            <Text
              style={styles.devButtonText}
            >
              Sign Out
            </Text>
          </Pressable>

          <Pressable
            style={styles.devButton}
            onPress={
              resetDevelopmentState
            }
          >
            <Text
              style={styles.devButtonText}
            >
              Reset Onboarding
            </Text>
          </Pressable>
        </View>
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

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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

  favouritesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  favouritesText: {
    fontSize: 22,
    color: '#F79009',
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
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#98A2B3',
    marginBottom: 12,
  },

  loader: {
    marginTop: 40,
  },

  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#667085',
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
    marginBottom: 4,
  },

  name: {
    flex: 1,
    marginRight: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#101828',
  },

  time: {
    fontSize: 12,
    color: '#98A2B3',
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  preview: {
    flex: 1,
    fontSize: 15,
    color: '#667085',
  },

  username: {
    marginTop: 4,
    fontSize: 12,
    color: '#98A2B3',
  },

  developmentSection: {
    marginTop: 'auto',
    marginBottom: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
  },

  developmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#98A2B3',
    marginBottom: 10,
  },

  devButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  devButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#344054',
  },
});