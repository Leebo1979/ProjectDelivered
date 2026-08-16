import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  edited_at: string | null;
  parent_message_id: string | null;
};

type OtherUser = {
  display_name: string;
  username: string;
};

type Reaction = {
  message_id: string;
  emoji: string;
  user_id: string;
};

type ReadMap = Record<string, boolean>;
type FavouriteMap = Record<string, boolean>;
type ReactionMap = Record<string, string[]>;
type SenderNameMap = Record<string, string>;
type TypingUserMap = Record<string, string>;

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

  const [currentDisplayName, setCurrentDisplayName] =
    useState('Someone');

  const [otherUser, setOtherUser] =
    useState<OtherUser | null>(null);

  const [conversationTitle, setConversationTitle] =
    useState('Conversation');

  const [isGroup, setIsGroup] =
    useState(false);

  const [readMap, setReadMap] =
    useState<ReadMap>({});

  const [favouriteMap, setFavouriteMap] =
    useState<FavouriteMap>({});

  const [reactionMap, setReactionMap] =
    useState<ReactionMap>({});

  const [senderNameMap, setSenderNameMap] =
    useState<SenderNameMap>({});

  const [typingUsers, setTypingUsers] =
    useState<TypingUserMap>({});

  const [replyingTo, setReplyingTo] =
    useState<Message | null>(null);

  const listRef =
    useRef<FlatList<Message>>(null);

  const typingChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const typingTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const typingText = useMemo(() => {
    const names = Object.values(typingUsers);

    if (names.length === 0) {
      return '';
    }

    if (names.length === 1) {
      return `${names[0]} is typing…`;
    }

    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing…`;
    }

    return `${names.length} people are typing…`;
  }, [typingUsers]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    if (
      !conversationId ||
      !currentUserId
    ) {
      return;
    }

    const messageChannel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage =
            payload.new as Message;

          setMessages((current) => {
            const exists =
              current.some(
                (item) =>
                  item.id === newMessage.id
              );

            if (exists) {
              return current;
            }

            return [
              ...current,
              newMessage,
            ];
          });

          if (isGroup) {
            await ensureSenderName(
              newMessage.sender_id
            );
          }

          if (
            newMessage.sender_id !==
            currentUserId
          ) {
            await markMessageRead(
              newMessage.id,
              currentUserId
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated =
            payload.new as Message & {
              deleted_at?: string | null;
            };

          if (updated.deleted_at) {
            setMessages((current) =>
              current.filter(
                (item) =>
                  item.id !== updated.id
              )
            );

            return;
          }

          setMessages((current) =>
            current.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    body: updated.body,
                    edited_at: updated.edited_at,
                  }
                : item
            )
          );
        }
      )
      .subscribe();

    const readChannel = supabase
      .channel(`reads:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          const read =
            payload.new as {
              message_id: string;
              user_id: string;
            };

          if (
            read.user_id !== currentUserId
          ) {
            setReadMap((current) => ({
              ...current,
              [read.message_id]: true,
            }));
          }
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'broadcast',
        {
          event: 'typing',
        },
        ({ payload }) => {
          const typingPayload =
            payload as {
              userId: string;
              displayName: string;
              isTyping: boolean;
            };

          if (
            typingPayload.userId ===
            currentUserId
          ) {
            return;
          }

          setTypingUsers((current) => {
            const next = {
              ...current,
            };

            if (
              typingPayload.isTyping
            ) {
              next[
                typingPayload.userId
              ] =
                typingPayload.displayName;
            } else {
              delete next[
                typingPayload.userId
              ];
            }

            return next;
          });
        }
      )
      .subscribe();

    typingChannelRef.current =
      typingChannel;

    return () => {
      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      typingChannelRef.current
        ?.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: currentUserId,
            displayName:
              currentDisplayName,
            isTyping: false,
          },
        })
        .catch(() => {});

      typingChannelRef.current =
        null;

      supabase.removeChannel(
        messageChannel
      );

      supabase.removeChannel(
        readChannel
      );

      supabase.removeChannel(
        typingChannel
      );
    };
  }, [
    conversationId,
    currentUserId,
    currentDisplayName,
    isGroup,
  ]);

  useEffect(() => {
    if (
      messages.length === 0
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        listRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);

    return () =>
      clearTimeout(timer);
  }, [messages]);

  const sendTypingStatus =
    async (
      isTypingNow: boolean
    ) => {
      if (
        !currentUserId ||
        !typingChannelRef.current
      ) {
        return;
      }

      try {
        await typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId:
              currentUserId,
            displayName:
              currentDisplayName,
            isTyping:
              isTypingNow,
          },
        });
      } catch (error) {
        console.error(
          'Typing broadcast error:',
          error
        );
      }
    };

  const handleMessageChange =
    (text: string) => {
      setMessage(text);

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      if (
        text.trim().length === 0
      ) {
        sendTypingStatus(false);
        return;
      }

      sendTypingStatus(true);

      typingTimeoutRef.current =
        setTimeout(() => {
          sendTypingStatus(false);
        }, 1200);
    };

  const ensureSenderName =
    async (
      senderId: string
    ) => {
      if (
        senderNameMap[
          senderId
        ]
      ) {
        return;
      }

      const {
        data: profile,
      } = await supabase
        .from('profiles')
        .select('display_name')
        .eq(
          'id',
          senderId
        )
        .maybeSingle();

      if (profile) {
        setSenderNameMap(
          (current) => ({
            ...current,
            [senderId]:
              profile.display_name,
          })
        );
      }
    };

  const loadSenderNames =
    async (
      loadedMessages: Message[]
    ) => {
      const uniqueSenderIds =
        [
          ...new Set(
            loadedMessages.map(
              (item) =>
                item.sender_id
            )
          ),
        ];

      if (
        uniqueSenderIds.length ===
        0
      ) {
        return;
      }

      const {
        data: profiles,
        error,
      } = await supabase
        .from('profiles')
        .select(
          'id, display_name'
        )
        .in(
          'id',
          uniqueSenderIds
        );

      if (error) {
        console.error(
          'Sender profile load error:',
          error
        );
        return;
      }

      const nextMap:
        SenderNameMap = {};

      for (
        const profile
        of profiles ?? []
      ) {
        nextMap[
          profile.id
        ] =
          profile.display_name;
      }

      setSenderNameMap(
        nextMap
      );
    };

  const loadConversation =
    async () => {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          console.error(
            'User load error:',
            userError
          );
          return;
        }

        setCurrentUserId(
          user.id
        );

        const {
          data: myProfile,
        } = await supabase
          .from('profiles')
          .select('display_name')
          .eq(
            'id',
            user.id
          )
          .maybeSingle();

        if (myProfile) {
          setCurrentDisplayName(
            myProfile.display_name
          );
        }

        const {
          data: conversation,
          error:
            conversationError,
        } = await supabase
          .from(
            'conversations'
          )
          .select(
            'id, title, is_group'
          )
          .eq(
            'id',
            conversationId
          )
          .single();

        if (
          conversationError
        ) {
          console.error(
            'Conversation load error:',
            conversationError
          );
        }

        if (conversation) {
          setIsGroup(
            conversation.is_group
          );

          if (
            conversation.is_group
          ) {
            setOtherUser(null);

            setConversationTitle(
              conversation.title ??
                'Group Conversation'
            );
          } else {
            const {
              data: members,
              error:
                membersError,
            } = await supabase
              .from(
                'conversation_members'
              )
              .select('user_id')
              .eq(
                'conversation_id',
                conversationId
              );

            if (!membersError) {
              const otherMember =
                members?.find(
                  (member) =>
                    member.user_id !==
                    user.id
                );

              if (
                otherMember
              ) {
                const {
                  data: profile,
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

                if (profile) {
                  setOtherUser(
                    profile
                  );

                  setConversationTitle(
                    profile.display_name
                  );
                }
              }
            }
          }
        }

        const {
          data,
          error,
        } = await supabase
          .from('messages')
          .select(
            `
            id,
            body,
            sender_id,
            created_at,
            edited_at,
            parent_message_id
            `
          )
          .eq(
            'conversation_id',
            conversationId
          )
          .is(
            'deleted_at',
            null
          )
          .order(
            'created_at',
            {
              ascending: true,
            }
          );

        if (error) {
          console.error(
            'Message load error:',
            error
          );
          return;
        }

        const loadedMessages =
          data ?? [];

        setMessages(
          loadedMessages
        );

        if (
          conversation?.is_group
        ) {
          await loadSenderNames(
            loadedMessages
          );
        }

        for (
          const item
          of loadedMessages
        ) {
          if (
            item.sender_id !==
            user.id
          ) {
            await markMessageRead(
              item.id,
              user.id
            );
          }
        }

        await loadReadReceipts(
          loadedMessages,
          user.id
        );

        await loadFavourites(
          loadedMessages,
          user.id
        );

        await loadReactions(
          loadedMessages
        );
      } catch (error) {
        console.error(
          'Conversation load error:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

  const loadReadReceipts =
    async (
      loadedMessages: Message[],
      userId: string
    ) => {
      const sentIds =
        loadedMessages
          .filter(
            (item) =>
              item.sender_id ===
              userId
          )
          .map(
            (item) =>
              item.id
          );

      if (
        sentIds.length === 0
      ) {
        return;
      }

      const {
        data: reads,
      } = await supabase
        .from(
          'message_reads'
        )
        .select(
          'message_id, user_id'
        )
        .in(
          'message_id',
          sentIds
        )
        .neq(
          'user_id',
          userId
        );

      const nextMap:
        ReadMap = {};

      for (
        const read
        of reads ?? []
      ) {
        nextMap[
          read.message_id
        ] = true;
      }

      setReadMap(nextMap);
    };

  const loadFavourites =
    async (
      loadedMessages: Message[],
      userId: string
    ) => {
      const ids =
        loadedMessages.map(
          (item) =>
            item.id
        );

      if (
        ids.length === 0
      ) {
        return;
      }

      const {
        data,
      } = await supabase
        .from(
          'favourite_messages'
        )
        .select('message_id')
        .eq(
          'user_id',
          userId
        )
        .in(
          'message_id',
          ids
        );

      const nextMap:
        FavouriteMap = {};

      for (
        const item
        of data ?? []
      ) {
        nextMap[
          item.message_id
        ] = true;
      }

      setFavouriteMap(
        nextMap
      );
    };

  const loadReactions =
    async (
      loadedMessages: Message[]
    ) => {
      const ids =
        loadedMessages.map(
          (item) =>
            item.id
        );

      if (
        ids.length === 0
      ) {
        return;
      }

      const {
        data,
      } = await supabase
        .from(
          'message_reactions'
        )
        .select(
          'message_id, emoji, user_id'
        )
        .in(
          'message_id',
          ids
        );

      const nextMap:
        ReactionMap = {};

      for (
        const reaction
        of (data ??
          []) as Reaction[]
      ) {
        if (
          !nextMap[
            reaction.message_id
          ]
        ) {
          nextMap[
            reaction.message_id
          ] = [];
        }

        nextMap[
          reaction.message_id
        ].push(
          reaction.emoji
        );
      }

      setReactionMap(
        nextMap
      );
    };

  const markMessageRead =
    async (
      messageId: string,
      explicitUserId?: string
    ) => {
      let userId =
        explicitUserId ??
        currentUserId;

      if (!userId) {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        userId =
          user?.id ?? null;
      }

      if (!userId) {
        return;
      }

      const {
        error,
      } = await supabase
        .from(
          'message_reads'
        )
        .upsert(
          {
            message_id:
              messageId,
            user_id:
              userId,
          },
          {
            onConflict:
              'message_id,user_id',
          }
        );

      if (error) {
        console.error(
          'Read receipt error:',
          error
        );
      }
    };

  const sendMessage =
    async () => {
      const trimmed =
        message.trim();

      if (
        !trimmed ||
        !currentUserId ||
        !conversationId ||
        sending
      ) {
        return;
      }

      try {
        setSending(true);

        if (
          typingTimeoutRef.current
        ) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        await sendTypingStatus(
          false
        );

        const {
          data,
          error,
        } = await supabase
          .from('messages')
          .insert({
            conversation_id:
              conversationId,
            sender_id:
              currentUserId,
            body: trimmed,
            parent_message_id:
              replyingTo?.id ??
              null,
          })
          .select(
            `
            id,
            body,
            sender_id,
            created_at,
            edited_at,
            parent_message_id
            `
          )
          .single();

        if (
          error ||
          !data
        ) {
          console.error(
            'Send error:',
            error
          );
          return;
        }

        setMessages(
          (current) => {
            const exists =
              current.some(
                (item) =>
                  item.id ===
                  data.id
              );

            if (exists) {
              return current;
            }

            return [
              ...current,
              data,
            ];
          }
        );

        setMessage('');
        setReplyingTo(null);
      } finally {
        setSending(false);
      }
    };

  const copyMessage =
    async (
      item: Message
    ) => {
      await Clipboard.setStringAsync(
        item.body
      );
    };

  const toggleFavourite =
    async (
      item: Message
    ) => {
      if (!currentUserId) {
        return;
      }

      const isFavourite =
        favouriteMap[
          item.id
        ];

      if (isFavourite) {
        const {
          error,
        } = await supabase
          .from(
            'favourite_messages'
          )
          .delete()
          .eq(
            'message_id',
            item.id
          )
          .eq(
            'user_id',
            currentUserId
          );

        if (!error) {
          setFavouriteMap(
            (current) => ({
              ...current,
              [item.id]:
                false,
            })
          );
        }

        return;
      }

      const {
        error,
      } = await supabase
        .from(
          'favourite_messages'
        )
        .insert({
          message_id:
            item.id,
          user_id:
            currentUserId,
        });

      if (!error) {
        setFavouriteMap(
          (current) => ({
            ...current,
            [item.id]:
              true,
          })
        );
      }
    };

  const addReaction =
    async (
      item: Message,
      emoji: string
    ) => {
      if (!currentUserId) {
        return;
      }

      const {
        error,
      } = await supabase
        .from(
          'message_reactions'
        )
        .upsert(
          {
            message_id:
              item.id,
            user_id:
              currentUserId,
            emoji,
          },
          {
            onConflict:
              'message_id,user_id,emoji',
          }
        );

      if (!error) {
        await loadReactions(
          messages
        );
      }
    };

  const showReactionPicker =
    (
      item: Message
    ) => {
      Alert.alert(
        'React',
        'Choose a reaction',
        [
          {
            text: '👍',
            onPress: () =>
              addReaction(
                item,
                '👍'
              ),
          },
          {
            text: '❤️',
            onPress: () =>
              addReaction(
                item,
                '❤️'
              ),
          },
          {
            text: '😂',
            onPress: () =>
              addReaction(
                item,
                '😂'
              ),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    };

  const editMessage =
    (
      item: Message
    ) => {
      if (
        Platform.OS !==
        'ios'
      ) {
        Alert.alert(
          'Edit Message',
          'Inline editing will be added for non-iOS builds later.'
        );
        return;
      }

      Alert.prompt(
        'Edit Message',
        'Update your message',
        async (newText) => {
          const trimmed =
            newText?.trim();

          if (
            !trimmed ||
            trimmed ===
              item.body
          ) {
            return;
          }

          const editedAt =
            new Date()
              .toISOString();

          const {
            error,
          } = await supabase
            .from('messages')
            .update({
              body: trimmed,
              edited_at:
                editedAt,
            })
            .eq(
              'id',
              item.id
            );

          if (error) {
            Alert.alert(
              'Unable to edit message',
              error.message
            );
            return;
          }

          setMessages(
            (current) =>
              current.map(
                (message) =>
                  message.id ===
                  item.id
                    ? {
                        ...message,
                        body:
                          trimmed,
                        edited_at:
                          editedAt,
                      }
                    : message
              )
          );
        },
        'plain-text',
        item.body
      );
    };

  const deleteMessage =
    async (
      item: Message
    ) => {
      const {
        error,
      } = await supabase
        .from('messages')
        .update({
          deleted_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          item.id
        );

      if (!error) {
        setMessages(
          (current) =>
            current.filter(
              (message) =>
                message.id !==
                item.id
            )
        );
      }
    };

  const confirmDelete =
    (
      item: Message
    ) => {
      Alert.alert(
        'Delete Message',
        'Delete this message?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style:
              'destructive',
            onPress: () =>
              deleteMessage(
                item
              ),
          },
        ]
      );
    };

  const showMessageActions =
    (
      item: Message
    ) => {
      const actions:
        any[] = [
        {
          text: 'Copy',
          onPress: () =>
            copyMessage(item),
        },
        {
          text: 'Reply',
          onPress: () =>
            setReplyingTo(
              item
            ),
        },
        {
          text:
            favouriteMap[
              item.id
            ]
              ? 'Remove Favourite'
              : 'Favourite',
          onPress: () =>
            toggleFavourite(
              item
            ),
        },
        {
          text: 'React',
          onPress: () =>
            showReactionPicker(
              item
            ),
        },
      ];

      if (
        item.sender_id ===
        currentUserId
      ) {
        actions.push({
          text: 'Edit',
          onPress: () =>
            editMessage(item),
        });

        actions.push({
          text: 'Delete',
          style:
            'destructive',
          onPress: () =>
            confirmDelete(
              item
            ),
        });
      }

      actions.push({
        text: 'Cancel',
        style: 'cancel',
      });

      Alert.alert(
        'Message',
        item.body,
        actions
      );
    };

  const findParentMessage =
    (
      parentId:
        string | null
    ) => {
      if (!parentId) {
        return null;
      }

      return (
        messages.find(
          (item) =>
            item.id ===
            parentId
        ) ?? null
      );
    };

  const openConversationDetails =
    () => {
      if (
        !isGroup ||
        !conversationId
      ) {
        return;
      }

      router.push({
        pathname:
          '/group-details',
        params: {
          conversationId,
        },
      });
    };

  const formatTime =
    (
      timestamp: string
    ) =>
      new Date(
        timestamp
      ).toLocaleTimeString(
        [],
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      );

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <KeyboardAvoidingView
        style={
          styles.screen
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
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

          <Pressable
            disabled={
              !isGroup
            }
            onPress={
              openConversationDetails
            }
            style={[
              styles.headerProfile,
              isGroup &&
                styles.headerProfilePressable,
            ]}
          >
            <View
              style={
                styles.avatar
              }
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {conversationTitle
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={
                styles.headerText
              }
            >
              <View
                style={
                  styles.headerTitleRow
                }
              >
                <Text
                  style={
                    styles.name
                  }
                  numberOfLines={
                    1
                  }
                >
                  {conversationTitle}
                </Text>

                {isGroup && (
                  <Text
                    style={
                      styles.detailsChevron
                    }
                  >
                    ›
                  </Text>
                )}
              </View>

              <Text
                style={
                  typingText
                    ? styles.typingStatus
                    : styles.status
                }
              >
                {typingText
                  ? typingText
                  : isGroup
                    ? 'Tap for group details'
                    : otherUser
                      ? `@${otherUser.username}`
                      : 'Live'}
              </Text>
            </View>
          </Pressable>
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
            keyExtractor={(
              item
            ) => item.id}
            contentContainerStyle={
              styles.messageList
            }
            renderItem={({
              item,
            }) => {
              const sentByMe =
                item.sender_id ===
                currentUserId;

              const isRead =
                readMap[
                  item.id
                ];

              const parent =
                findParentMessage(
                  item.parent_message_id
                );

              const reactions =
                reactionMap[
                  item.id
                ] ?? [];

              const senderName =
                senderNameMap[
                  item.sender_id
                ] ??
                'Unknown';

              return (
                <Pressable
                  onLongPress={() =>
                    showMessageActions(
                      item
                    )
                  }
                  delayLongPress={
                    350
                  }
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
                    {isGroup &&
                      !sentByMe && (
                        <Text
                          style={
                            styles.senderName
                          }
                        >
                          {senderName}
                        </Text>
                      )}

                    {parent && (
                      <View
                        style={
                          styles.replyPreview
                        }
                      >
                        <Text
                          style={
                            styles.replyPreviewText
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {parent.body}
                        </Text>
                      </View>
                    )}

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

                    {reactions.length >
                      0 && (
                      <View
                        style={
                          styles.reactionRow
                        }
                      >
                        {reactions.map(
                          (
                            emoji,
                            index
                          ) => (
                            <Text
                              key={`${emoji}-${index}`}
                              style={
                                styles.reaction
                              }
                            >
                              {emoji}
                            </Text>
                          )
                        )}
                      </View>
                    )}

                    <View
                      style={
                        styles.metaRow
                      }
                    >
                      {favouriteMap[
                        item.id
                      ] && (
                        <Text
                          style={
                            styles.star
                          }
                        >
                          ★
                        </Text>
                      )}

                      <Text
                        style={
                          styles.timestamp
                        }
                      >
                        {sentByMe
                          ? isRead
                            ? 'Read '
                            : 'Sent '
                          : ''}
                        {formatTime(
                          item.created_at
                        )}
                        {item.edited_at
                          ? ' · Edited'
                          : ''}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {replyingTo && (
          <View
            style={
              styles.replyingBar
            }
          >
            <View
              style={
                styles.replyingTextContainer
              }
            >
              <Text
                style={
                  styles.replyingLabel
                }
              >
                Replying to
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={
                  styles.replyingText
                }
              >
                {
                  replyingTo.body
                }
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setReplyingTo(
                  null
                )
              }
            >
              <Text
                style={
                  styles.closeReply
                }
              >
                ×
              </Text>
            </Pressable>
          </View>
        )}

        {typingText ? (
          <View
            style={
              styles.typingBar
            }
          >
            <Text
              style={
                styles.typingBarText
              }
            >
              {typingText}
            </Text>
          </View>
        ) : null}

        <View
          style={
            styles.composer
          }
        >
          <TextInput
            value={message}
            onChangeText={
              handleMessageChange
            }
            placeholder={
              replyingTo
                ? 'Write a reply'
                : 'Message'
            }
            placeholderTextColor="#98A2B3"
            style={
              styles.input
            }
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
            onPress={
              sendMessage
            }
          >
            <Text
              style={
                styles.sendText
              }
            >
              {sending
                ? '…'
                : '↑'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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

    screen: {
      flex: 1,
    },

    header: {
      height: 72,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
      backgroundColor:
        '#FFFFFF',
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

    headerProfile: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },

    headerProfilePressable: {
      paddingVertical: 5,
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#E8ECFB',
      alignItems: 'center',
      justifyContent:
        'center',
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

    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    name: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '700',
      color: '#101828',
    },

    detailsChevron: {
      marginLeft: 6,
      fontSize: 21,
      lineHeight: 22,
      color: '#98A2B3',
    },

    status: {
      fontSize: 12,
      color: '#667085',
      marginTop: 2,
    },

    typingStatus: {
      fontSize: 12,
      fontWeight: '600',
      color: '#4169E1',
      marginTop: 2,
    },

    loaderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    messageList: {
      paddingHorizontal: 18,
      paddingVertical: 24,
    },

    receivedRow: {
      alignItems:
        'flex-start',
      marginBottom: 14,
    },

    sentRow: {
      alignItems:
        'flex-end',
      marginBottom: 14,
    },

    messageGroup: {
      maxWidth: '78%',
      alignItems:
        'flex-start',
    },

    messageGroupSent: {
      alignItems:
        'flex-end',
    },

    senderName: {
      fontSize: 12,
      fontWeight: '700',
      color: '#4169E1',
      marginLeft: 8,
      marginBottom: 4,
    },

    replyPreview: {
      maxWidth: '100%',
      backgroundColor:
        '#F2F4F7',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
      marginBottom: 4,
    },

    replyPreviewText: {
      fontSize: 12,
      color: '#667085',
    },

    receivedBubble: {
      backgroundColor:
        '#EAECF0',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 18,
      borderBottomLeftRadius:
        5,
    },

    sentBubble: {
      backgroundColor:
        '#4169E1',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 18,
      borderBottomRightRadius:
        5,
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

    reactionRow: {
      flexDirection: 'row',
      marginTop: 5,
    },

    reaction: {
      fontSize: 17,
      marginRight: 4,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
    },

    star: {
      fontSize: 12,
      color: '#F79009',
      marginRight: 4,
    },

    timestamp: {
      fontSize: 11,
      color: '#98A2B3',
      paddingHorizontal: 4,
    },

    replyingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor:
        '#F2F4F7',
      borderTopWidth: 1,
      borderTopColor:
        '#EAECF0',
    },

    replyingTextContainer: {
      flex: 1,
    },

    replyingLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#4169E1',
    },

    replyingText: {
      marginTop: 2,
      fontSize: 13,
      color: '#667085',
    },

    closeReply: {
      fontSize: 28,
      color: '#667085',
      paddingLeft: 12,
    },

    typingBar: {
      minHeight: 24,
      paddingHorizontal: 20,
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
    },

    typingBarText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#4169E1',
    },

    composer: {
      flexDirection: 'row',
      alignItems:
        'flex-end',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor:
        '#EAECF0',
      backgroundColor:
        '#FFFFFF',
    },

    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 10,
      fontSize: 16,
      color: '#101828',
      backgroundColor:
        '#F9FAFB',
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginLeft: 9,
      backgroundColor:
        '#4169E1',
      alignItems: 'center',
      justifyContent:
        'center',
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