import {
    router,
    useFocusEffect,
} from 'expo-router';
import {
    useCallback,
    useEffect,
    useState,
} from 'react';
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

type ConversationRow = {
  id: string;
  title: string | null;
  is_group: boolean;
  created_at: string;
};

type ArchivedChatItem = {
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

export default function ArchivedChatsScreen() {
  const [
    chats,
    setChats,
  ] = useState<
    ArchivedChatItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadArchivedChats();
    }, [])
  );

  useEffect(() => {
    let messageChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    let readChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    let archiveChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    let muteChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    let pinChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    let cancelled = false;

    const subscribe =
      async () => {
        const {
          data: { user },
          error,
        } =
          await supabase.auth.getUser();

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
              `archived-messages:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table:
                  'messages',
              },
              async () => {
                await loadArchivedChats(
                  false
                );
              }
            )
            .subscribe();

        readChannel =
          supabase
            .channel(
              `archived-reads:${user.id}`
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table:
                  'message_reads',
              },
              async () => {
                await loadArchivedChats(
                  false
                );
              }
            )
            .subscribe();

        archiveChannel =
          supabase
            .channel(
              `archived-state:${user.id}`
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
                await loadArchivedChats(
                  false
                );
              }
            )
            .subscribe();

        muteChannel =
          supabase
            .channel(
              `archived-mutes:${user.id}`
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
                await loadArchivedChats(
                  false
                );
              }
            )
            .subscribe();

        pinChannel =
          supabase
            .channel(
              `archived-pins:${user.id}`
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
                await loadArchivedChats(
                  false
                );
              }
            )
            .subscribe();
      };

    subscribe();

    return () => {
      cancelled = true;

      if (messageChannel) {
        supabase.removeChannel(
          messageChannel
        );
      }

      if (readChannel) {
        supabase.removeChannel(
          readChannel
        );
      }

      if (archiveChannel) {
        supabase.removeChannel(
          archiveChannel
        );
      }

      if (muteChannel) {
        supabase.removeChannel(
          muteChannel
        );
      }

      if (pinChannel) {
        supabase.removeChannel(
          pinChannel
        );
      }
    };
  }, []);

  const loadArchivedChats =
    async (
      showLoader = true
    ) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          Alert.alert(
            'Not signed in',
            'Please sign in again.'
          );

          router.replace(
            '/sign-up'
          );

          return;
        }

        const {
          data:
            archivedRows,
          error:
            archivedError,
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
          );

        if (archivedError) {
          Alert.alert(
            'Unable to load archived chats',
            archivedError.message
          );
          return;
        }

        const conversationIds =
          (
            archivedRows ??
            []
          ).map(
            (item) =>
              item.conversation_id
          );

        if (
          conversationIds.length ===
          0
        ) {
          setChats([]);
          return;
        }

        const {
          data: conversations,
          error:
            conversationError,
        } = await supabase
          .from(
            'conversations'
          )
          .select(
            'id, title, is_group, created_at'
          )
          .in(
            'id',
            conversationIds
          );

        if (conversationError) {
          Alert.alert(
            'Unable to load archived chats',
            conversationError.message
          );
          return;
        }

        const [
          mutedResult,
          pinnedResult,
        ] =
          await Promise.all([
            supabase
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
              ),

            supabase
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
              ),
          ]);

        const mutedIds =
          new Set(
            (
              mutedResult.data ??
              []
            ).map(
              (item) =>
                item.conversation_id
            )
          );

        const pinnedIds =
          new Set(
            (
              pinnedResult.data ??
              []
            ).map(
              (item) =>
                item.conversation_id
            )
          );

        const chatItems =
          await Promise.all(
            (
              conversations as ConversationRow[]
            ).map(
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
                  } = await supabase
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

                  const otherMember =
                    memberRows?.find(
                      (member) =>
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

                const {
                  data:
                    latestMessageRows,
                } = await supabase
                  .from(
                    'messages'
                  )
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
                } = await supabase
                  .from(
                    'messages'
                  )
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

                let unreadCount =
                  0;

                if (
                  incomingMessages &&
                  incomingMessages.length >
                    0
                ) {
                  const incomingIds =
                    incomingMessages.map(
                      (item) =>
                        item.id
                    );

                  const {
                    data:
                      readRows,
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

                  const readIds =
                    new Set(
                      (
                        readRows ??
                        []
                      ).map(
                        (item) =>
                          item.message_id
                      )
                    );

                  unreadCount =
                    incomingIds.filter(
                      (id) =>
                        !readIds.has(
                          id
                        )
                    ).length;
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
        );

        setChats(
          chatItems
        );
      } catch (error) {
        console.error(
          'Load archived chats error:',
          error
        );

        Alert.alert(
          'Unable to load archived chats',
          'Please try again.'
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    };

  const unarchive =
    async (
      chat: ArchivedChatItem
    ) => {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        return;
      }

      const {
        error,
      } = await supabase
        .from(
          'archived_conversations'
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
          'Unable to unarchive',
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
    };

  const showActions =
    (
      chat: ArchivedChatItem
    ) => {
      Alert.alert(
        chat.displayName,
        'Archived conversation',
        [
          {
            text:
              'Unarchive Conversation',
            onPress: () =>
              unarchive(
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

  const formatChatTime =
    (
      timestamp:
        string | null
    ) => {
      if (!timestamp) {
        return '';
      }

      const date =
        new Date(
          timestamp
        );

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
            hour:
              'numeric',
            minute:
              '2-digit',
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
          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backText
              }
            >
              ‹
            </Text>
          </Pressable>

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
              Archived
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          ARCHIVED CHATS
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
              No archived conversations
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Long-press a conversation on the Chats screen and choose Archive Conversation.
            </Text>
          </View>
        ) : (
          chats.map(
            (chat) => (
              <Pressable
                key={
                  chat.id
                }
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
                  showActions(
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
                      @
                      {chat.username}
                    </Text>
                  )}
                </View>
              </Pressable>
            )
          )
        )}

        {chats.length >
          0 && (
          <Text
            style={
              styles.helpText
            }
          >
            Long-press an archived chat to restore it.
          </Text>
        )}
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
      marginBottom: 30,
    },

    backButton: {
      width: 36,
      marginRight: 6,
    },

    backText: {
      fontSize: 38,
      lineHeight: 40,
      color:
        '#4169E1',
    },

    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.6,
      color:
        '#4169E1',
      marginBottom: 4,
    },

    title: {
      fontSize: 34,
      fontWeight: '800',
      color:
        '#101828',
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
      paddingVertical: 50,
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
      maxWidth: 300,
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

    helpText: {
      marginTop: 18,
      marginBottom: 24,
      fontSize: 12,
      textAlign:
        'center',
      color:
        '#98A2B3',
    },
  });