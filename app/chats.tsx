import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { registerForPushNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';

const ONBOARDING_KEY =
  'project_delivered_onboarding_complete';

const BIOMETRICS_KEY =
  'project_delivered_biometrics_enabled';

const PIN_STORAGE_KEY =
  'project_delivered_pin';

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
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
};

export default function ChatsScreen() {
  const [chats, setChats] =
    useState<ChatListItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useEffect(() => {
    let messageChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    let readChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    let muteChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    let pinChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    let archiveChannel:
      ReturnType<typeof supabase.channel> | null =
      null;

    let cancelled = false;

    const subscribeToRealtime =
      async () => {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (
          cancelled ||
          error ||
          !user
        ) {
          return;
        }

        messageChannel =
          supabase
            .channel(
              `chat-list-messages:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'messages',
              },
              async () => {
                await loadChats(
                  false
                );
              }
            )
            .subscribe();

        readChannel =
          supabase
            .channel(
              `chat-list-reads:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table:
                  'message_reads',
              },
              async (
                payload
              ) => {
                const row =
                  (
                    payload.new ??
                    payload.old
                  ) as {
                    user_id?:
                      string;
                  };

                if (
                  row.user_id ===
                  user.id
                ) {
                  await loadChats(
                    false
                  );
                }
              }
            )
            .subscribe();

        muteChannel =
          supabase
            .channel(
              `chat-list-mutes:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table:
                  'muted_conversations',
                filter:
                  `user_id=eq.${user.id}`,
              },
              async () => {
                await loadChats(
                  false
                );
              }
            )
            .subscribe();

        pinChannel =
          supabase
            .channel(
              `chat-list-pins:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table:
                  'pinned_conversations',
                filter:
                  `user_id=eq.${user.id}`,
              },
              async () => {
                await loadChats(
                  false
                );
              }
            )
            .subscribe();

        archiveChannel =
          supabase
            .channel(
              `chat-list-archives:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table:
                  'archived_conversations',
                filter:
                  `user_id=eq.${user.id}`,
              },
              async () => {
                await loadChats(
                  false
                );
              }
            )
            .subscribe();
      };

    subscribeToRealtime();

    return () => {
      cancelled = true;

      if (
        messageChannel
      ) {
        supabase.removeChannel(
          messageChannel
        );
      }

      if (
        readChannel
      ) {
        supabase.removeChannel(
          readChannel
        );
      }

      if (
        muteChannel
      ) {
        supabase.removeChannel(
          muteChannel
        );
      }

      if (
        pinChannel
      ) {
        supabase.removeChannel(
          pinChannel
        );
      }

      if (
        archiveChannel
      ) {
        supabase.removeChannel(
          archiveChannel
        );
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const loadChats = async (
    showLoader = true
  ) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Not signed in',
          'Please sign in again.'
        );

        router.replace('/sign-up');
        return;
      }

      const {
        data: memberships,
        error: membershipError,
      } = await supabase
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
          (item) =>
            item.conversation_id
        ) ?? [];

      if (
        conversationIds.length === 0
      ) {
        setChats([]);
        return;
      }

      const {
        data: conversations,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select(
          'id, title, is_group, created_at'
        )
        .in(
          'id',
          conversationIds
        );

      if (conversationError) {
        Alert.alert(
          'Unable to load chats',
          conversationError.message
        );
        return;
      }

      const {
        data: mutedRows,
        error: mutedError,
      } = await supabase
        .from(
          'muted_conversations'
        )
        .select(
          'conversation_id'
        )
        .eq(
          'user_id',
          user.id
        )
        .in(
          'conversation_id',
          conversationIds
        );

      if (mutedError) {
        console.error(
          'Muted conversations load error:',
          mutedError
        );
      }

      const mutedIds =
        new Set(
          (
            mutedRows ??
            []
          ).map(
            (item) =>
              item.conversation_id
          )
        );

      const {
        data: pinnedRows,
        error: pinnedError,
      } = await supabase
        .from(
          'pinned_conversations'
        )
        .select(
          'conversation_id'
        )
        .eq(
          'user_id',
          user.id
        )
        .in(
          'conversation_id',
          conversationIds
        );

      if (pinnedError) {
        console.error(
          'Pinned conversations load error:',
          pinnedError
        );
      }

      const pinnedIds =
        new Set(
          (
            pinnedRows ??
            []
          ).map(
            (item) =>
              item.conversation_id
          )
        );

      const {
        data: archivedRows,
        error: archivedError,
      } = await supabase
        .from(
          'archived_conversations'
        )
        .select(
          'conversation_id'
        )
        .eq(
          'user_id',
          user.id
        )
        .in(
          'conversation_id',
          conversationIds
        );

      if (archivedError) {
        console.error(
          'Archived conversations load error:',
          archivedError
        );
      }

      const archivedIds =
        new Set(
          (
            archivedRows ??
            []
          ).map(
            (item) =>
              item.conversation_id
          )
        );

      const visibleConversations =
        (
          conversations as ConversationRow[]
        ).filter(
          (conversation) =>
            !archivedIds.has(
              conversation.id
            )
        );

      const chatItems =
        await Promise.all(
          visibleConversations.map(
            async (
              conversation
            ) => {
              let displayName =
                conversation.title ??
                'Conversation';

              let username:
                string | null =
                null;

              if (
                !conversation.is_group
              ) {
                const {
                  data:
                    memberRows,
                  error:
                    membersError,
                } =
                  await supabase
                    .from(
                      'conversation_members'
                    )
                    .select(
                      'user_id'
                    )
                    .eq(
                      'conversation_id',
                      conversation.id
                    );

                if (
                  !membersError
                ) {
                  const otherMember =
                    memberRows?.find(
                      (
                        member
                      ) =>
                        member.user_id !==
                        user.id
                    );

                  if (
                    otherMember
                  ) {
                    const {
                      data:
                        otherProfile,
                    } =
                      await supabase
                        .from(
                          'profiles'
                        )
                        .select(
                          'display_name, username'
                        )
                        .eq(
                          'id',
                          otherMember.user_id
                        )
                        .maybeSingle();

                    if (
                      otherProfile
                    ) {
                      displayName =
                        otherProfile.display_name;

                      username =
                        otherProfile.username;
                    }
                  }
                }
              }

              const {
                data:
                  latestMessageRows,
              } = await supabase
                .from('messages')
                .select(
                  'id, body, created_at'
                )
                .eq(
                  'conversation_id',
                  conversation.id
                )
                .is(
                  'deleted_at',
                  null
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(1);

              const latestMessage =
                latestMessageRows?.[0];

              const {
                data:
                  incomingMessages,
                error:
                  incomingError,
              } = await supabase
                .from('messages')
                .select('id')
                .eq(
                  'conversation_id',
                  conversation.id
                )
                .neq(
                  'sender_id',
                  user.id
                )
                .is(
                  'deleted_at',
                  null
                );

              let unreadCount = 0;

              if (
                !incomingError &&
                incomingMessages &&
                incomingMessages.length >
                  0
              ) {
                const incomingIds =
                  incomingMessages.map(
                    (
                      item
                    ) => item.id
                  );

                const {
                  data:
                    readRows,
                  error:
                    readError,
                } = await supabase
                  .from(
                    'message_reads'
                  )
                  .select(
                    'message_id'
                  )
                  .eq(
                    'user_id',
                    user.id
                  )
                  .in(
                    'message_id',
                    incomingIds
                  );

                if (!readError) {
                  const readIds =
                    new Set(
                      (
                        readRows ??
                        []
                      ).map(
                        (
                          item
                        ) =>
                          item.message_id
                      )
                    );

                  unreadCount =
                    incomingIds.filter(
                      (
                        id
                      ) =>
                        !readIds.has(
                          id
                        )
                    ).length;
                }
              }

              return {
                id:
                  conversation.id,

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

                unreadCount,

                isMuted:
                  mutedIds.has(
                    conversation.id
                  ),

                isPinned:
                  pinnedIds.has(
                    conversation.id
                  ),
              };
            }
          )
        );

      chatItems.sort(
        (a, b) => {
          if (
            a.isPinned !==
            b.isPinned
          ) {
            return a.isPinned
              ? -1
              : 1;
          }

          const aTime =
            a.latestMessageAt
              ? new Date(
                  a.latestMessageAt
                ).getTime()
              : 0;

          const bTime =
            b.latestMessageAt
              ? new Date(
                  b.latestMessageAt
                ).getTime()
              : 0;

          return bTime - aTime;
        }
      );

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
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const togglePin =
    async (
      chat: ChatListItem
    ) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        Alert.alert(
          'Not signed in',
          'Please sign in again.'
        );
        return;
      }

      if (chat.isPinned) {
        const {
          error,
        } = await supabase
          .from(
            'pinned_conversations'
          )
          .delete()
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'conversation_id',
            chat.id
          );

        if (error) {
          Alert.alert(
            'Unable to unpin',
            error.message
          );
          return;
        }

        setChats(
          (current) =>
            current
              .map(
                (item) =>
                  item.id ===
                  chat.id
                    ? {
                        ...item,
                        isPinned:
                          false,
                      }
                    : item
              )
              .sort(
                (a, b) => {
                  if (
                    a.isPinned !==
                    b.isPinned
                  ) {
                    return a.isPinned
                      ? -1
                      : 1;
                  }

                  const aTime =
                    a.latestMessageAt
                      ? new Date(
                          a.latestMessageAt
                        ).getTime()
                      : 0;

                  const bTime =
                    b.latestMessageAt
                      ? new Date(
                          b.latestMessageAt
                        ).getTime()
                      : 0;

                  return (
                    bTime -
                    aTime
                  );
                }
              )
        );

        return;
      }

      const {
        error,
      } = await supabase
        .from(
          'pinned_conversations'
        )
        .insert({
          user_id:
            user.id,
          conversation_id:
            chat.id,
        });

      if (error) {
        Alert.alert(
          'Unable to pin',
          error.message
        );
        return;
      }

      setChats(
        (current) =>
          current
            .map(
              (item) =>
                item.id ===
                chat.id
                  ? {
                      ...item,
                      isPinned:
                        true,
                    }
                  : item
            )
            .sort(
              (a, b) => {
                if (
                  a.isPinned !==
                  b.isPinned
                ) {
                  return a.isPinned
                    ? -1
                    : 1;
                }

                const aTime =
                  a.latestMessageAt
                    ? new Date(
                        a.latestMessageAt
                      ).getTime()
                    : 0;

                const bTime =
                  b.latestMessageAt
                    ? new Date(
                        b.latestMessageAt
                      ).getTime()
                    : 0;

                return (
                  bTime -
                  aTime
                );
              }
            )
      );
    };

  const toggleMute =
    async (
      chat: ChatListItem
    ) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        Alert.alert(
          'Not signed in',
          'Please sign in again.'
        );
        return;
      }

      if (chat.isMuted) {
        const {
          error,
        } = await supabase
          .from(
            'muted_conversations'
          )
          .delete()
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'conversation_id',
            chat.id
          );

        if (error) {
          Alert.alert(
            'Unable to unmute',
            error.message
          );
          return;
        }

        setChats(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                chat.id
                  ? {
                      ...item,
                      isMuted: false,
                    }
                  : item
            )
        );

        return;
      }

      const {
        error,
      } = await supabase
        .from(
          'muted_conversations'
        )
        .insert({
          user_id:
            user.id,
          conversation_id:
            chat.id,
        });

      if (error) {
        Alert.alert(
          'Unable to mute',
          error.message
        );
        return;
      }

      setChats(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              chat.id
                ? {
                    ...item,
                    isMuted: true,
                  }
                : item
          )
      );
    };

  const archiveConversation =
    async (
      chat: ChatListItem
    ) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        Alert.alert(
          'Not signed in',
          'Please sign in again.'
        );
        return;
      }

      Alert.alert(
        'Archive Conversation',
        `Archive ${chat.displayName}?`,
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Archive',
            onPress:
              async () => {
                const {
                  error,
                } = await supabase
                  .from(
                    'archived_conversations'
                  )
                  .insert({
                    user_id:
                      user.id,
                    conversation_id:
                      chat.id,
                  });

                if (error) {
                  Alert.alert(
                    'Unable to archive',
                    error.message
                  );
                  return;
                }

                setChats(
                  (current) =>
                    current.filter(
                      (item) =>
                        item.id !==
                        chat.id
                    )
                );
              },
          },
        ]
      );
    };

  const showChatActions =
    (
      chat: ChatListItem
    ) => {
      Alert.alert(
        chat.displayName,
        chat.isMuted
          ? 'Notifications are muted for this conversation.'
          : 'Choose an action.',
        [
          {
            text:
              chat.isPinned
                ? 'Unpin Conversation'
                : 'Pin Conversation',
            onPress: () =>
              togglePin(
                chat
              ),
          },
          {
            text:
              chat.isMuted
                ? 'Unmute Notifications'
                : 'Mute Notifications',
            onPress: () =>
              toggleMute(
                chat
              ),
          },
          {
            text:
              'Archive Conversation',
            onPress: () =>
              archiveConversation(
                chat
              ),
          },
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
        ]
      );
    };

  const showNewChatMenu =
    () => {
      Alert.alert(
        'New Conversation',
        'What would you like to create?',
        [
          {
            text:
              'New Message',
            onPress: () =>
              router.push(
                '/find-user'
              ),
          },
          {
            text:
              'New Group',
            onPress: () =>
              router.push(
                '/create-group'
              ),
          },
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
        ]
      );
    };

  const openSearch =
    () => {
      router.push(
        '/search-messages'
      );
    };

  const openArchived =
    () => {
      router.push(
        '/archived-chats'
      );
    };

  const signOut =
    async () => {
      try {
        const {
          error,
        } =
          await supabase.auth.signOut();

        if (error) {
          Alert.alert(
            'Unable to sign out',
            error.message
          );
          return;
        }

        router.replace(
          '/sign-up'
        );
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
    timestamp:
      string | null
  ) => {
    if (!timestamp) {
      return '';
    }

    const date =
      new Date(timestamp);

    const now =
      new Date();

    const sameDay =
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getDate() ===
        now.getDate();

    if (sameDay) {
      return date.toLocaleTimeString(
        [],
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      );
    }

    return date.toLocaleDateString(
      [],
      {
        month: 'short',
        day: 'numeric',
      }
    );
  };

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.container
        }
      >
        <View
          style={
            styles.header
          }
        >
          <View>
            <Text
              style={
                styles.eyebrow
              }
            >
              PROJECT DELIVERED
            </Text>

            <Text
              style={
                styles.title
              }
            >
              Chats
            </Text>
          </View>

          <View
            style={
              styles.headerActions
            }
          >
            <Pressable
              style={
                styles.searchButton
              }
              onPress={
                openSearch
              }
            >
              <Text
                style={
                  styles.searchIcon
                }
              >
                ⌕
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.favouritesButton
              }
              onPress={() =>
                router.push(
                  '/favourites'
                )
              }
            >
              <Text
                style={
                  styles.favouritesText
                }
              >
                ★
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.archivedButton
              }
              onPress={
                openArchived
              }
            >
              <Text
                style={
                  styles.archivedButtonText
                }
              >
                ARCH
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.newChatButton
              }
              onPress={
                showNewChatMenu
              }
            >
              <Text
                style={
                  styles.newChatText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          RECENT
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={
              styles.loader
            }
          />
        ) : chats.length ===
          0 ? (
          <View
            style={
              styles.emptyState
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No conversations yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Tap the + button to start a message or create a group.
            </Text>
          </View>
        ) : (
          chats.map(
            (chat) => (
              <Pressable
                key={chat.id}
                style={
                  styles.chat
                }
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
                onLongPress={() =>
                  showChatActions(
                    chat
                  )
                }
                delayLongPress={
                  350
                }
              >
                <View
                  style={[
                    styles.avatar,
                    chat.isGroup &&
                      styles.groupAvatar,
                  ]}
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {chat.displayName
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View
                  style={
                    styles.chatContent
                  }
                >
                  <View
                    style={
                      styles.chatTopRow
                    }
                  >
                    <View
                      style={
                        styles.nameRow
                      }
                    >
                      <Text
                        style={[
                          styles.name,
                          chat.unreadCount >
                            0 &&
                            styles.unreadName,
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          chat.displayName
                        }
                      </Text>

                      {chat.isGroup && (
                        <Text
                          style={
                            styles.groupLabel
                          }
                        >
                          GROUP
                        </Text>
                      )}

                      {chat.isPinned && (
                        <Text
                          style={
                            styles.pinnedLabel
                          }
                        >
                          PINNED
                        </Text>
                      )}

                      {chat.isMuted && (
                        <Text
                          style={
                            styles.mutedLabel
                          }
                        >
                          MUTED
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        styles.rightColumn
                      }
                    >
                      <Text
                        style={[
                          styles.time,
                          chat.unreadCount >
                            0 &&
                            styles.unreadTime,
                        ]}
                      >
                        {formatChatTime(
                          chat.latestMessageAt
                        )}
                      </Text>

                      {chat.unreadCount >
                        0 && (
                        <View
                          style={
                            styles.unreadBadge
                          }
                        >
                          <Text
                            style={
                              styles.unreadBadgeText
                            }
                          >
                            {chat.unreadCount >
                            99
                              ? '99+'
                              : chat.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.preview,
                      chat.unreadCount >
                        0 &&
                        styles.unreadPreview,
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    {
                      chat.latestMessage
                    }
                  </Text>

                  {chat.username && (
                    <Text
                      style={
                        styles.username
                      }
                    >
                      @{chat.username}
                    </Text>
                  )}
                </View>
              </Pressable>
            )
          )
        )}

        <View
          style={
            styles.developmentSection
          }
        >
          <Text
            style={
              styles.developmentLabel
            }
          >
            DEVELOPMENT
          </Text>

          <Pressable
            style={
              styles.devButton
            }
            onPress={
              signOut
            }
          >
            <Text
              style={
                styles.devButtonText
              }
            >
              Sign Out
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.devButton
            }
            onPress={
              resetDevelopmentState
            }
          >
            <Text
              style={
                styles.devButtonText
              }
            >
              Reset Onboarding
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#F7F8FA',
    },

    container: {
      flex: 1,
      paddingHorizontal:
        22,
      paddingTop: 20,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 34,
    },

    headerActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.6,
      color:
        '#4169E1',
      marginBottom: 6,
    },

    title: {
      fontSize: 38,
      fontWeight: '800',
      color:
        '#101828',
    },

    searchButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    searchIcon: {
      fontSize: 26,
      lineHeight: 28,
      color:
        '#4169E1',
      fontWeight: '600',
    },

    favouritesButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    favouritesText: {
      fontSize: 22,
      color:
        '#F79009',
    },

    archivedButton: {
      width: 54,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    archivedButtonText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color:
        '#667085',
    },

    newChatButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#4169E1',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    newChatText: {
      color:
        '#FFFFFF',
      fontSize: 28,
      lineHeight: 30,
    },

    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.4,
      color:
        '#98A2B3',
      marginBottom: 12,
    },

    loader: {
      marginTop: 40,
    },

    emptyState: {
      paddingVertical: 40,
      alignItems:
        'center',
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color:
        '#101828',
      marginBottom: 8,
    },

    emptyText: {
      fontSize: 15,
      lineHeight: 22,
      textAlign:
        'center',
      color:
        '#667085',
    },

    chat: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        '#E8ECFB',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 14,
    },

    groupAvatar: {
      backgroundColor:
        '#EAF7EF',
    },

    avatarText: {
      fontSize: 20,
      fontWeight: '700',
      color:
        '#4169E1',
    },

    chatContent: {
      flex: 1,
    },

    chatTopRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
      marginBottom: 4,
    },

    nameRow: {
      flex: 1,
      flexDirection:
        'row',
      alignItems:
        'center',
      marginRight: 10,
    },

    name: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '700',
      color:
        '#101828',
    },

    unreadName: {
      fontWeight: '800',
    },

    groupLabel: {
      marginLeft: 8,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      color:
        '#027A48',
      backgroundColor:
        '#ECFDF3',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
    },

    pinnedLabel: {
      marginLeft: 8,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      color:
        '#6941C6',
      backgroundColor:
        '#F4F3FF',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
    },

    mutedLabel: {
      marginLeft: 8,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      color:
        '#667085',
      backgroundColor:
        '#F2F4F7',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
    },

    rightColumn: {
      alignItems:
        'flex-end',
    },

    time: {
      fontSize: 12,
      color:
        '#98A2B3',
    },

    unreadTime: {
      color:
        '#4169E1',
      fontWeight: '700',
    },

    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor:
        '#4169E1',
      paddingHorizontal: 6,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 6,
    },

    unreadBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color:
        '#FFFFFF',
    },

    preview: {
      fontSize: 15,
      color:
        '#667085',
    },

    unreadPreview: {
      color:
        '#344054',
      fontWeight: '600',
    },

    username: {
      marginTop: 4,
      fontSize: 12,
      color:
        '#98A2B3',
    },

    developmentSection: {
      marginTop: 'auto',
      marginBottom: 30,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor:
        '#EAECF0',
    },

    developmentLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      color:
        '#98A2B3',
      marginBottom: 10,
    },

    devButton: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      backgroundColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 10,
    },

    devButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color:
        '#344054',
    },
  });