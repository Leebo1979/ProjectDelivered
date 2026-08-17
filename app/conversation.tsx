import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import {
  useVideoPlayer,
  VideoView,
} from 'expo-video';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
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
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
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

type PendingAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
  isImage: boolean;
};

type ReadMap = Record<string, boolean>;
type FavouriteMap = Record<string, boolean>;
type ReactionMap = Record<string, string[]>;
type SenderNameMap = Record<string, string>;
type TypingUserMap = Record<string, string>;
type AttachmentUrlMap = Record<string, string>;

function formatAudioTime(seconds: number) {
  const safeSeconds =
    Number.isFinite(seconds) && seconds > 0
      ? Math.floor(seconds)
      : 0;

  const minutes =
    Math.floor(safeSeconds / 60);

  const remainingSeconds =
    safeSeconds % 60;

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

function VoiceMessagePlayer({
  url,
  sentByMe,
}: {
  url: string;
  sentByMe: boolean;
}) {
  const player =
    useAudioPlayer(url, {
      updateInterval: 250,
    });

  const status =
    useAudioPlayerStatus(
      player
    );

  const togglePlayback =
    async () => {
      if (status.playing) {
        player.pause();
        return;
      }

      if (
        status.duration > 0 &&
        status.currentTime >=
          status.duration - 0.15
      ) {
        await player.seekTo(0);
      }

      player.play();
    };

  const progress =
    status.duration > 0
      ? Math.min(
          1,
          status.currentTime /
            status.duration
        )
      : 0;

  return (
    <Pressable
      style={
        sentByMe
          ? styles.sentVoiceCard
          : styles.receivedVoiceCard
      }
      onPress={
        togglePlayback
      }
    >
      <View
        style={
          sentByMe
            ? styles.sentVoiceButton
            : styles.receivedVoiceButton
        }
      >
        <Text
          style={
            sentByMe
              ? styles.sentVoiceButtonText
              : styles.receivedVoiceButtonText
          }
        >
          {status.playing
            ? 'Ⅱ'
            : '▶'}
        </Text>
      </View>

      <View
        style={
          styles.voiceInfo
        }
      >
        <View
          style={
            sentByMe
              ? styles.sentVoiceTrack
              : styles.receivedVoiceTrack
          }
        >
          <View
            style={[
              sentByMe
                ? styles.sentVoiceProgress
                : styles.receivedVoiceProgress,
              {
                width:
                  `${progress * 100}%`,
              },
            ]}
          />
        </View>

        <Text
          style={
            sentByMe
              ? styles.sentVoiceTime
              : styles.receivedVoiceTime
          }
        >
          {formatAudioTime(
            status.playing
              ? status.currentTime
              : status.duration ||
                  status.currentTime
          )}
        </Text>
      </View>
    </Pressable>
  );
}


function VideoMessagePlayer({
  url,
}: {
  url: string;
}) {
  const player =
    useVideoPlayer(
      url,
      (videoPlayer) => {
        videoPlayer.loop = false;
      }
    );

  return (
    <View
      style={
        styles.videoCard
      }
    >
      <VideoView
        player={
          player
        }
        style={
          styles.inlineVideo
        }
        nativeControls
        contentFit="cover"
      />
    </View>
  );
}


function PendingVoicePreview({
  uri,
  durationMillis,
  onRemove,
}: {
  uri: string;
  durationMillis: number | null;
  onRemove: () => void;
}) {
  const player =
    useAudioPlayer(uri, {
      updateInterval: 200,
    });

  const status =
    useAudioPlayerStatus(
      player
    );

  const togglePlayback =
    async () => {
      if (status.playing) {
        player.pause();
        return;
      }

      if (
        status.duration > 0 &&
        status.currentTime >=
          status.duration - 0.15
      ) {
        await player.seekTo(0);
      }

      player.play();
    };

  const displaySeconds =
    status.playing
      ? status.currentTime
      : status.duration ||
        (
          durationMillis
            ? durationMillis / 1000
            : 0
        );

  return (
    <View
      style={
        styles.pendingVoiceCard
      }
    >
      <Pressable
        style={
          styles.pendingVoicePlayButton
        }
        onPress={
          togglePlayback
        }
      >
        <Text
          style={
            styles.pendingVoicePlayText
          }
        >
          {status.playing
            ? 'Ⅱ'
            : '▶'}
        </Text>
      </Pressable>

      <View
        style={
          styles.pendingVoiceContent
        }
      >
        <Text
          style={
            styles.pendingVoiceTitle
          }
        >
          Voice message ready
        </Text>

        <View
          style={
            styles.pendingVoiceWave
          }
        >
          {[
            8, 14, 20, 12, 18, 24,
            10, 16, 22, 14, 18, 10,
          ].map(
            (
              height,
              index
            ) => (
              <View
                key={
                  index
                }
                style={[
                  styles.pendingVoiceWaveBar,
                  {
                    height,
                  },
                ]}
              />
            )
          )}
        </View>

        <Text
          style={
            styles.pendingVoiceDuration
          }
        >
          {formatAudioTime(
            displaySeconds
          )}
        </Text>
      </View>

      <Pressable
        style={
          styles.pendingVoiceRemoveButton
        }
        onPress={
          onRemove
        }
      >
        <Text
          style={
            styles.pendingVoiceRemoveText
          }
        >
          ×
        </Text>
      </Pressable>
    </View>
  );
}

export default function ConversationScreen() {
  const { conversationId } =
    useLocalSearchParams<{
      conversationId: string;
    }>();

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [message, setMessage] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [
    currentDisplayName,
    setCurrentDisplayName,
  ] = useState('Someone');

  const [otherUser, setOtherUser] =
    useState<OtherUser | null>(null);

  const [
    conversationTitle,
    setConversationTitle,
  ] = useState('Conversation');

  const [isGroup, setIsGroup] =
    useState(false);

  const [
    groupAvatarUrl,
    setGroupAvatarUrl,
  ] = useState<string | null>(
    null
  );

  const [readMap, setReadMap] =
    useState<ReadMap>({});

  const [
    favouriteMap,
    setFavouriteMap,
  ] = useState<FavouriteMap>({});

  const [
    reactionMap,
    setReactionMap,
  ] = useState<ReactionMap>({});

  const [
    senderNameMap,
    setSenderNameMap,
  ] = useState<SenderNameMap>({});

  const [
    typingUsers,
    setTypingUsers,
  ] = useState<TypingUserMap>({});

  const [
    attachmentUrlMap,
    setAttachmentUrlMap,
  ] = useState<AttachmentUrlMap>({});

  const [replyingTo, setReplyingTo] =
    useState<Message | null>(null);

  const [
    pendingAttachment,
    setPendingAttachment,
  ] = useState<PendingAttachment | null>(
    null
  );

  const [
    pendingVoiceDurationMillis,
    setPendingVoiceDurationMillis,
  ] = useState<number | null>(
    null
  );

  const [
    reactionTarget,
    setReactionTarget,
  ] = useState<Message | null>(
    null
  );

  const [
    fullScreenImageUrl,
    setFullScreenImageUrl,
  ] = useState<string | null>(
    null
  );

  const audioRecorder =
    useAudioRecorder(
      RecordingPresets.HIGH_QUALITY
    );

  const recorderState =
    useAudioRecorderState(
      audioRecorder,
      250
    );

  const listRef =
    useRef<FlatList<Message>>(null);

  const typingChannelRef =
    useRef<
      ReturnType<typeof supabase.channel> | null
    >(null);

  const typingTimeoutRef =
    useRef<
      ReturnType<typeof setTimeout> | null
    >(null);

  const typingText =
    useMemo(() => {
      const names =
        Object.values(
          typingUsers
        );

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

    const messageChannel =
      supabase
        .channel(
          `messages:${conversationId}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter:
              `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const newMessage =
              payload.new as Message;

            setMessages(
              (current) => {
                const exists =
                  current.some(
                    (item) =>
                      item.id ===
                      newMessage.id
                  );

                if (exists) {
                  return current;
                }

                return [
                  ...current,
                  newMessage,
                ];
              }
            );

            if (
              newMessage.attachment_path
            ) {
              await loadAttachmentUrl(
                newMessage
              );
            }

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
            filter:
              `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const updated =
              payload.new as Message & {
                deleted_at?: string | null;
              };

            if (
              updated.deleted_at
            ) {
              setMessages(
                (current) =>
                  current.filter(
                    (item) =>
                      item.id !==
                      updated.id
                  )
              );

              return;
            }

            setMessages(
              (current) =>
                current.map(
                  (item) =>
                    item.id ===
                    updated.id
                      ? {
                          ...item,
                          ...updated,
                        }
                      : item
                )
            );
          }
        )
        .subscribe();

    const readChannel =
      supabase
        .channel(
          `reads:${conversationId}`
        )
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
              read.user_id !==
              currentUserId
            ) {
              setReadMap(
                (current) => ({
                  ...current,
                  [read.message_id]:
                    true,
                })
              );
            }
          }
        )
        .subscribe();

    const typingChannel =
      supabase
        .channel(
          `typing:${conversationId}`
        )
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

            setTypingUsers(
              (current) => {
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
              }
            );
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

  const loadAttachmentUrl =
    async (
      item: Message
    ) => {
      if (
        !item.attachment_path
      ) {
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .storage
        .from(
          'message-attachments'
        )
        .createSignedUrl(
          item.attachment_path,
          60 * 60
        );

      if (
        error ||
        !data
      ) {
        console.error(
          'Attachment signed URL error:',
          error
        );
        return;
      }

      setAttachmentUrlMap(
        (current) => ({
          ...current,
          [item.id]:
            data.signedUrl,
        })
      );
    };

  const loadAttachmentUrls =
    async (
      loadedMessages: Message[]
    ) => {
      const attachmentMessages =
        loadedMessages.filter(
          (item) =>
            !!item.attachment_path
        );

      await Promise.all(
        attachmentMessages.map(
          (item) =>
            loadAttachmentUrl(
              item
            )
        )
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
            'id, title, is_group, avatar_path'
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
            conversation.is_group &&
            conversation.avatar_path
          ) {
            const {
              data:
                avatarData,
              error:
                avatarError,
            } =
              await supabase
                .storage
                .from(
                  'message-attachments'
                )
                .createSignedUrl(
                  conversation.avatar_path,
                  60 * 60
                );

            if (
              !avatarError &&
              avatarData
            ) {
              setGroupAvatarUrl(
                avatarData.signedUrl
              );
            } else {
              setGroupAvatarUrl(
                null
              );
            }
          } else {
            setGroupAvatarUrl(
              null
            );
          }

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

            if (
              !membersError
            ) {
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
            parent_message_id,
            attachment_path,
            attachment_name,
            attachment_type,
            attachment_size
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

        await loadAttachmentUrls(
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
      loadedMessages:
        Message[],
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

      setReadMap(
        nextMap
      );
    };

  const loadFavourites =
    async (
      loadedMessages:
        Message[],
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
      loadedMessages:
        Message[]
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
      explicitUserId?:
        string
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

  const startVoiceRecording =
    async () => {
      try {
        if (
          sending ||
          uploading ||
          recorderState.isRecording
        ) {
          return;
        }

        const permission =
          await AudioModule.requestRecordingPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            'Microphone access required',
            'Please allow microphone access to record voice messages.'
          );
          return;
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        setPendingAttachment(
          null
        );

        setPendingVoiceDurationMillis(
          null
        );

        await audioRecorder.prepareToRecordAsync();

        audioRecorder.record();
      } catch (error) {
        console.error(
          'Voice recording start error:',
          error
        );

        Alert.alert(
          'Unable to record',
          'Please try again.'
        );
      }
    };

  const stopVoiceRecording =
    async () => {
      if (
        !recorderState.isRecording
      ) {
        return;
      }

      try {
        const durationMillis =
          recorderState.durationMillis;

        await audioRecorder.stop();

        const uri =
          audioRecorder.uri;

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });

        if (!uri) {
          Alert.alert(
            'Unable to save recording',
            'The recording did not produce an audio file.'
          );
          return;
        }

        setPendingVoiceDurationMillis(
          durationMillis
        );

        setPendingAttachment({
          uri,
          name:
            `voice-${Date.now()}.m4a`,
          mimeType:
            'audio/mp4',
          size: null,
          isImage: false,
        });
      } catch (error) {
        console.error(
          'Voice recording stop error:',
          error
        );

        Alert.alert(
          'Unable to finish recording',
          'Please try again.'
        );
      }
    };

  const cancelVoiceRecording =
    async () => {
      try {
        if (
          recorderState.isRecording
        ) {
          await audioRecorder.stop();
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
      } catch (error) {
        console.error(
          'Voice recording cancel error:',
          error
        );
      } finally {
        setPendingVoiceDurationMillis(
          null
        );

        setPendingAttachment(
          null
        );
      }
    };

  const createStoragePath =
    (
      name: string
    ) => {
      const safeName =
        name.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

      return `${conversationId}/${currentUserId}/${Date.now()}-${safeName}`;
    };

  const choosePhoto =
    async () => {
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (
          permission.status !==
          'granted'
        ) {
          Alert.alert(
            'Photo access required',
            'Please allow photo library access to attach a photo.'
          );
          return;
        }

        const result =
          await ImagePicker.launchImageLibraryAsync({
            mediaTypes:
              ImagePicker.MediaTypeOptions.Images,
            allowsEditing:
              false,
            quality: 0.9,
          });

        if (
          result.canceled
        ) {
          return;
        }

        const asset =
          result.assets[0];

        const name =
          asset.fileName ??
          `photo-${Date.now()}.jpg`;

        setPendingVoiceDurationMillis(
          null
        );

        setPendingAttachment({
          uri:
            asset.uri,
          name,
          mimeType:
            asset.mimeType ??
            'image/jpeg',
          size:
            asset.fileSize ??
            null,
          isImage: true,
        });
      } catch (error) {
        console.error(
          'Photo picker error:',
          error
        );

        Alert.alert(
          'Unable to select photo',
          'Please try again.'
        );
      }
    };

  const chooseFile =
    async () => {
      try {
        const result =
          await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory:
              true,
            multiple: false,
          });

        if (
          result.canceled
        ) {
          return;
        }

        const asset =
          result.assets[0];

        setPendingVoiceDurationMillis(
          null
        );

        setPendingAttachment({
          uri:
            asset.uri,
          name:
            asset.name,
          mimeType:
            asset.mimeType ??
            'application/octet-stream',
          size:
            asset.size ??
            null,
          isImage:
            asset.mimeType?.startsWith(
              'image/'
            ) ?? false,
        });
      } catch (error) {
        console.error(
          'File picker error:',
          error
        );

        Alert.alert(
          'Unable to select file',
          'Please try again.'
        );
      }
    };

  const showAttachmentMenu =
    () => {
      Alert.alert(
        'Attach',
        'Choose what to send',
        [
          {
            text:
              'Photo',
            onPress:
              choosePhoto,
          },
          {
            text:
              'File',
            onPress:
              chooseFile,
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

  const uploadAttachment =
    async (
      attachment:
        PendingAttachment
    ) => {
      if (
        !currentUserId ||
        !conversationId
      ) {
        return null;
      }

      const path =
        createStoragePath(
          attachment.name
        );

      const response =
        await fetch(
          attachment.uri
        );

      const arrayBuffer =
        await response.arrayBuffer();

      const {
        error,
      } = await supabase
        .storage
        .from(
          'message-attachments'
        )
        .upload(
          path,
          arrayBuffer,
          {
            contentType:
              attachment.mimeType,
            upsert: false,
          }
        );

      if (error) {
        throw error;
      }

      return path;
    };

  const sendMessage =
    async () => {
      const trimmed =
        message.trim();

      if (
        (!trimmed &&
          !pendingAttachment) ||
        !currentUserId ||
        !conversationId ||
        sending ||
        uploading
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

        let attachmentPath:
          string | null =
          null;

        if (
          pendingAttachment
        ) {
          setUploading(true);

          attachmentPath =
            await uploadAttachment(
              pendingAttachment
            );
        }

        const isVoiceAttachment =
          pendingAttachment?.mimeType.startsWith(
            'audio/'
          ) ?? false;

        const body =
          trimmed ||
          (pendingAttachment
            ? isVoiceAttachment
              ? 'Voice message'
              : `Attachment: ${pendingAttachment.name}`
            : '');

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
            body,
            parent_message_id:
              replyingTo?.id ??
              null,
            attachment_path:
              attachmentPath,
            attachment_name:
              pendingAttachment?.name ??
              null,
            attachment_type:
              pendingAttachment?.mimeType ??
              null,
            attachment_size:
              pendingAttachment?.size ??
              null,
          })
          .select(
            `
            id,
            body,
            sender_id,
            created_at,
            edited_at,
            parent_message_id,
            attachment_path,
            attachment_name,
            attachment_type,
            attachment_size
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

          Alert.alert(
            'Unable to send',
            error?.message ??
              'Please try again.'
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

        if (
          data.attachment_path
        ) {
          await loadAttachmentUrl(
            data
          );
        }

        setMessage('');
        setReplyingTo(null);
        setPendingAttachment(
          null
        );
        setPendingVoiceDurationMillis(
          null
        );
      } catch (error: any) {
        console.error(
          'Attachment send error:',
          error
        );

        Alert.alert(
          'Unable to send attachment',
          error?.message ??
            'Please try again.'
        );
      } finally {
        setUploading(false);
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
      if (
        !currentUserId
      ) {
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

  const toggleReaction =
    async (
      item: Message,
      emoji: string
    ) => {
      if (
        !currentUserId
      ) {
        return;
      }

      const {
        data: existing,
        error:
          existingError,
      } = await supabase
        .from(
          'message_reactions'
        )
        .select(
          'message_id'
        )
        .eq(
          'message_id',
          item.id
        )
        .eq(
          'user_id',
          currentUserId
        )
        .eq(
          'emoji',
          emoji
        )
        .maybeSingle();

      if (existingError) {
        Alert.alert(
          'Unable to update reaction',
          existingError.message
        );
        return;
      }

      if (existing) {
        const {
          error,
        } = await supabase
          .from(
            'message_reactions'
          )
          .delete()
          .eq(
            'message_id',
            item.id
          )
          .eq(
            'user_id',
            currentUserId
          )
          .eq(
            'emoji',
            emoji
          );

        if (error) {
          Alert.alert(
            'Unable to remove reaction',
            error.message
          );
          return;
        }
      } else {
        const {
          error,
        } = await supabase
          .from(
            'message_reactions'
          )
          .insert({
            message_id:
              item.id,
            user_id:
              currentUserId,
            emoji,
          });

        if (error) {
          Alert.alert(
            'Unable to add reaction',
            error.message
          );
          return;
        }
      }

      await loadReactions(
        messages
      );
    };

  const showReactionPicker =
    (
      item: Message
    ) => {
      setReactionTarget(
        item
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
        async (
          newText
        ) => {
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
              body:
                trimmed,
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
      try {
        if (
          item.attachment_path
        ) {
          const {
            error:
              storageError,
          } =
            await supabase
              .storage
              .from(
                'message-attachments'
              )
              .remove([
                item.attachment_path,
              ]);

          if (storageError) {
            Alert.alert(
              'Unable to delete attachment',
              storageError.message
            );
            return;
          }
        }

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

        if (error) {
          Alert.alert(
            'Unable to delete message',
            error.message
          );
          return;
        }

        setMessages(
          (current) =>
            current.filter(
              (message) =>
                message.id !==
                item.id
            )
        );

        setAttachmentUrlMap(
          (current) => {
            const next = {
              ...current,
            };

            delete next[
              item.id
            ];

            return next;
          }
        );
      } catch (error: any) {
        console.error(
          'Delete message error:',
          error
        );

        Alert.alert(
          'Unable to delete message',
          error?.message ??
            'Please try again.'
        );
      }
    };

  const confirmDelete =
    (
      item: Message
    ) => {
      Alert.alert(
        'Delete Message',
        item.attachment_path
          ? 'Delete this message and its attachment?'
          : 'Delete this message?',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Delete',
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
          text:
            'Copy',
          onPress: () =>
            copyMessage(
              item
            ),
        },
        {
          text:
            'Reply',
          onPress: () =>
            setReplyingTo(
              item
            ),
        },
        {
          text:
            'Forward',
          onPress: () =>
            router.push({
              pathname:
                '/forward-message',
              params: {
                messageId:
                  item.id,
                sourceConversationId:
                  conversationId,
              },
            }),
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
          text:
            'React',
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
          text:
            'Edit',
          onPress: () =>
            editMessage(
              item
            ),
        });

        actions.push({
          text:
            'Delete',
          style:
            'destructive',
          onPress: () =>
            confirmDelete(
              item
            ),
        });
      }

      actions.push({
        text:
          'Cancel',
        style:
          'cancel',
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

  const openMediaAndFiles =
    () => {
      if (!conversationId) {
        return;
      }

      router.push({
        pathname:
          '/media-files',
        params: {
          conversationId,
          title:
            conversationTitle,
        },
      });
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

  const openImageFullScreen =
    (
      item: Message
    ) => {
      const url =
        attachmentUrlMap[
          item.id
        ];

      if (!url) {
        Alert.alert(
          'Image unavailable',
          'Please wait for the image to finish loading and try again.'
        );
        return;
      }

      setFullScreenImageUrl(
        url
      );
    };

  const openAttachment =
    async (
      item: Message
    ) => {
      if (
        !item.attachment_path
      ) {
        return;
      }

      let url =
        attachmentUrlMap[
          item.id
        ];

      if (!url) {
        const {
          data,
          error,
        } = await supabase
          .storage
          .from(
            'message-attachments'
          )
          .createSignedUrl(
            item.attachment_path,
            60 * 60
          );

        if (
          error ||
          !data
        ) {
          Alert.alert(
            'Unable to open attachment',
            error?.message ??
              'Please try again.'
          );
          return;
        }

        url =
          data.signedUrl;

        setAttachmentUrlMap(
          (current) => ({
            ...current,
            [item.id]:
              url,
          })
        );
      }

      const canOpen =
        await Linking.canOpenURL(
          url
        );

      if (canOpen) {
        await Linking.openURL(
          url
        );
      } else {
        Alert.alert(
          'Unable to open file',
          'This attachment cannot be opened on this device.'
        );
      }
    };

  const getFileTypeLabel =
    (
      mimeType:
        string | null,
      fileName:
        string | null
    ) => {
      if (
        mimeType ===
          'application/pdf' ||
        fileName
          ?.toLowerCase()
          .endsWith('.pdf')
      ) {
        return 'PDF';
      }

      if (
        mimeType?.includes(
          'word'
        ) ||
        fileName
          ?.toLowerCase()
          .endsWith('.doc') ||
        fileName
          ?.toLowerCase()
          .endsWith('.docx')
      ) {
        return 'WORD';
      }

      if (
        mimeType?.includes(
          'spreadsheet'
        ) ||
        mimeType?.includes(
          'excel'
        ) ||
        fileName
          ?.toLowerCase()
          .endsWith('.xls') ||
        fileName
          ?.toLowerCase()
          .endsWith('.xlsx')
      ) {
        return 'SHEET';
      }

      if (
        mimeType?.includes(
          'presentation'
        ) ||
        mimeType?.includes(
          'powerpoint'
        ) ||
        fileName
          ?.toLowerCase()
          .endsWith('.ppt') ||
        fileName
          ?.toLowerCase()
          .endsWith('.pptx')
      ) {
        return 'SLIDES';
      }

      if (
        mimeType?.startsWith(
          'text/'
        )
      ) {
        return 'TEXT';
      }

      return 'FILE';
    };

  const shareAttachment =
    async (
      item: Message
    ) => {
      if (
        !item.attachment_path
      ) {
        return;
      }

      let url =
        attachmentUrlMap[
          item.id
        ];

      if (!url) {
        const {
          data,
          error,
        } = await supabase
          .storage
          .from(
            'message-attachments'
          )
          .createSignedUrl(
            item.attachment_path,
            60 * 60
          );

        if (
          error ||
          !data
        ) {
          Alert.alert(
            'Unable to share attachment',
            error?.message ??
              'Please try again.'
          );
          return;
        }

        url =
          data.signedUrl;

        setAttachmentUrlMap(
          (current) => ({
            ...current,
            [item.id]:
              url,
          })
        );
      }

      try {
        await Share.share({
          title:
            item.attachment_name ??
            'Attachment',
          message:
            url,
          url,
        });
      } catch (error) {
        console.error(
          'Share attachment error:',
          error
        );

        Alert.alert(
          'Unable to share attachment',
          'Please try again.'
        );
      }
    };

  const showAttachmentActions =
    (
      item: Message
    ) => {
      Alert.alert(
        item.attachment_name ??
          'Attachment',
        getFileTypeLabel(
          item.attachment_type,
          item.attachment_name
        ),
        [
          {
            text:
              'Open',
            onPress: () =>
              openAttachment(
                item
              ),
          },
          {
            text:
              'Share',
            onPress: () =>
              shareAttachment(
                item
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

  const formatFileSize =
    (
      bytes:
        number | null
    ) => {
      if (!bytes) {
        return '';
      }

      if (
        bytes < 1024
      ) {
        return `${bytes} B`;
      }

      if (
        bytes <
        1024 * 1024
      ) {
        return `${(
          bytes / 1024
        ).toFixed(1)} KB`;
      }

      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(1)} MB`;
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
          hour:
            'numeric',
          minute:
            '2-digit',
        }
      );

  const isSameMessageDate =
    (
      firstTimestamp: string,
      secondTimestamp: string
    ) => {
      const first =
        new Date(
          firstTimestamp
        );

      const second =
        new Date(
          secondTimestamp
        );

      return (
        first.getFullYear() ===
          second.getFullYear() &&
        first.getMonth() ===
          second.getMonth() &&
        first.getDate() ===
          second.getDate()
      );
    };

  const formatMessageDate =
    (
      timestamp: string
    ) => {
      const date =
        new Date(
          timestamp
        );

      const today =
        new Date();

      const yesterday =
        new Date();

      yesterday.setDate(
        today.getDate() - 1
      );

      if (
        isSameMessageDate(
          timestamp,
          today.toISOString()
        )
      ) {
        return 'Today';
      }

      if (
        isSameMessageDate(
          timestamp,
          yesterday.toISOString()
        )
      ) {
        return 'Yesterday';
      }

      const sameYear =
        date.getFullYear() ===
        today.getFullYear();

      return date.toLocaleDateString(
        [],
        sameYear
          ? {
              weekday:
                'long',
              day:
                'numeric',
              month:
                'long',
            }
          : {
              day:
                'numeric',
              month:
                'long',
              year:
                'numeric',
            }
      );
    };

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
              {isGroup &&
              groupAvatarUrl ? (
                <Image
                  source={{
                    uri:
                      groupAvatarUrl,
                  }}
                  style={
                    styles.avatarImage
                  }
                />
              ) : (
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {conversationTitle
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              )}
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
                  {
                    conversationTitle
                  }
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

          <Pressable
            style={
              styles.mediaButton
            }
            onPress={
              openMediaAndFiles
            }
          >
            <Text
              style={
                styles.mediaButtonText
              }
            >
              MEDIA
            </Text>
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
            ref={
              listRef
            }
            data={
              messages
            }
            keyExtractor={(
              item
            ) =>
              item.id
            }
            contentContainerStyle={
              styles.messageList
            }
            renderItem={({
              item,
              index,
            }) => {
              const previousMessage =
                index > 0
                  ? messages[
                      index - 1
                    ]
                  : null;

              const showDateSeparator =
                !previousMessage ||
                !isSameMessageDate(
                  previousMessage.created_at,
                  item.created_at
                );

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

              const groupedReactions =
                Object.entries(
                  reactions.reduce<
                    Record<
                      string,
                      number
                    >
                  >(
                    (
                      counts,
                      emoji
                    ) => {
                      counts[
                        emoji
                      ] =
                        (
                          counts[
                            emoji
                          ] ??
                          0
                        ) + 1;

                      return counts;
                    },
                    {}
                  )
                );

              const senderName =
                senderNameMap[
                  item.sender_id
                ] ??
                'Unknown';

              const attachmentUrl =
                attachmentUrlMap[
                  item.id
                ];

              const isImage =
                item.attachment_type?.startsWith(
                  'image/'
                ) ?? false;

              const isAudio =
                item.attachment_type?.startsWith(
                  'audio/'
                ) ?? false;

              const isVideo =
                item.attachment_type?.startsWith(
                  'video/'
                ) ?? false;

              const shouldShowBody =
                !!item.body &&
                !(
                  isAudio &&
                  item.body ===
                    'Voice message'
                );

              return (
                <>
                  {showDateSeparator && (
                    <View
                      style={
                        styles.dateSeparator
                      }
                    >
                      <View
                        style={
                          styles.dateSeparatorLine
                        }
                      />

                      <Text
                        style={
                          styles.dateSeparatorText
                        }
                      >
                        {formatMessageDate(
                          item.created_at
                        )}
                      </Text>

                      <View
                        style={
                          styles.dateSeparatorLine
                        }
                      />
                    </View>
                  )}

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
                          {
                            senderName
                          }
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
                          {
                            parent.body
                          }
                        </Text>
                      </View>
                    )}

                    {item.attachment_path &&
                      isImage &&
                      attachmentUrl && (
                        <Pressable
                          onPress={() =>
                            openImageFullScreen(
                              item
                            )
                          }
                        >
                          <Image
                            source={{
                              uri:
                                attachmentUrl,
                            }}
                            style={
                              styles.attachmentImage
                            }
                            resizeMode="cover"
                          />
                        </Pressable>
                      )}

                    {item.attachment_path &&
                      isVideo &&
                      attachmentUrl && (
                        <VideoMessagePlayer
                          url={
                            attachmentUrl
                          }
                        />
                      )}

                    {item.attachment_path &&
                      isAudio &&
                      attachmentUrl && (
                        <VoiceMessagePlayer
                          url={
                            attachmentUrl
                          }
                          sentByMe={
                            sentByMe
                          }
                        />
                      )}

                    {item.attachment_path &&
                      !isImage &&
                      !isAudio &&
                      !isVideo && (
                        <Pressable
                          style={
                            sentByMe
                              ? styles.sentFileCard
                              : styles.receivedFileCard
                          }
                          onPress={() =>
                            openAttachment(
                              item
                            )
                          }
                          onLongPress={() =>
                            showAttachmentActions(
                              item
                            )
                          }
                          delayLongPress={
                            350
                          }
                        >
                          <View
                            style={
                              sentByMe
                                ? styles.sentFileBadge
                                : styles.receivedFileBadge
                            }
                          >
                            <Text
                              style={
                                sentByMe
                                  ? styles.sentFileBadgeText
                                  : styles.receivedFileBadgeText
                              }
                            >
                              {getFileTypeLabel(
                                item.attachment_type,
                                item.attachment_name
                              )}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.fileInfo
                            }
                          >
                            <Text
                              style={
                                sentByMe
                                  ? styles.sentFileName
                                  : styles.receivedFileName
                              }
                              numberOfLines={
                                2
                              }
                            >
                              {item.attachment_name ??
                                'Attachment'}
                            </Text>

                            <Text
                              style={
                                sentByMe
                                  ? styles.sentFileMeta
                                  : styles.receivedFileMeta
                              }
                            >
                              {[
                                getFileTypeLabel(
                                  item.attachment_type,
                                  item.attachment_name
                                ),
                                item.attachment_size
                                  ? formatFileSize(
                                      item.attachment_size
                                    )
                                  : null,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(' · ')}
                            </Text>

                            <Text
                              style={
                                sentByMe
                                  ? styles.sentFileHint
                                  : styles.receivedFileHint
                              }
                            >
                              Tap to open · Hold for options
                            </Text>
                          </View>
                        </Pressable>
                      )}

                    {shouldShowBody ? (
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
                          {
                            item.body
                          }
                        </Text>
                      </View>
                    ) : null}

                    {groupedReactions.length >
                      0 && (
                      <View
                        style={
                          styles.reactionRow
                        }
                      >
                        {groupedReactions.map(
                          ([
                            emoji,
                            count,
                          ]) => (
                            <Pressable
                              key={
                                emoji
                              }
                              style={
                                styles.reactionChip
                              }
                              onPress={() =>
                                toggleReaction(
                                  item,
                                  emoji
                                )
                              }
                            >
                              <Text
                                style={
                                  styles.reaction
                                }
                              >
                                {emoji}
                              </Text>

                              {count >
                                1 && (
                                <Text
                                  style={
                                    styles.reactionCount
                                  }
                                >
                                  {
                                    count
                                  }
                                </Text>
                              )}
                            </Pressable>
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
                </>
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

        {recorderState.isRecording && (
          <View
            style={
              styles.recordingBar
            }
          >
            <View
              style={
                styles.recordingDot
              }
            />

            <View
              style={
                styles.recordingInfo
              }
            >
              <Text
                style={
                  styles.recordingLabel
                }
              >
                Recording…
              </Text>

              <Text
                style={
                  styles.recordingTime
                }
              >
                {formatAudioTime(
                  recorderState.durationMillis /
                    1000
                )}
              </Text>
            </View>

            <Pressable
              style={
                styles.cancelRecordingButton
              }
              onPress={
                cancelVoiceRecording
              }
            >
              <Text
                style={
                  styles.cancelRecordingText
                }
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.stopRecordingButton
              }
              onPress={
                stopVoiceRecording
              }
            >
              <Text
                style={
                  styles.stopRecordingText
                }
              >
                Stop
              </Text>
            </Pressable>
          </View>
        )}

        {pendingAttachment &&
        pendingAttachment.mimeType.startsWith(
          'audio/'
        ) ? (
          <PendingVoicePreview
            uri={
              pendingAttachment.uri
            }
            durationMillis={
              pendingVoiceDurationMillis
            }
            onRemove={() => {
              setPendingAttachment(
                null
              );

              setPendingVoiceDurationMillis(
                null
              );
            }}
          />
        ) : pendingAttachment ? (
          <View
            style={
              styles.pendingAttachment
            }
          >
            <View
              style={
                styles.pendingAttachmentInfo
              }
            >
              <Text
                style={
                  styles.pendingAttachmentLabel
                }
              >
                Attachment
              </Text>

              <Text
                style={
                  styles.pendingAttachmentName
                }
                numberOfLines={
                  1
                }
              >
                {
                  pendingAttachment.name
                }
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setPendingAttachment(
                  null
                );

                setPendingVoiceDurationMillis(
                  null
                );
              }}
            >
              <Text
                style={
                  styles.removeAttachment
                }
              >
                ×
              </Text>
            </Pressable>
          </View>
        ) : null}

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
              {
                typingText
              }
            </Text>
          </View>
        ) : null}

        <View
          style={
            styles.composer
          }
        >
          <Pressable
            style={
              styles.attachmentButton
            }
            onPress={
              showAttachmentMenu
            }
            disabled={
              sending ||
              uploading ||
              recorderState.isRecording
            }
          >
            <Text
              style={
                styles.attachmentButtonText
              }
            >
              +
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.microphoneButton,
              recorderState.isRecording &&
                styles.microphoneButtonRecording,
            ]}
            onPress={
              recorderState.isRecording
                ? stopVoiceRecording
                : startVoiceRecording
            }
            disabled={
              sending ||
              uploading
            }
          >
            <Text
              style={[
                styles.microphoneButtonText,
                recorderState.isRecording &&
                  styles.microphoneButtonTextRecording,
              ]}
            >
              {recorderState.isRecording
                ? 'STOP'
                : 'MIC'}
            </Text>
          </Pressable>

          <TextInput
            value={
              message
            }
            editable={
              !recorderState.isRecording
            }
            onChangeText={
              handleMessageChange
            }
            placeholder={
              recorderState.isRecording
                ? 'Recording…'
                : pendingAttachment
                  ? 'Add a message'
                  : replyingTo
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
              recorderState.isRecording ||
              (!message.trim() &&
                !pendingAttachment) ||
              sending ||
              uploading
            }
            style={[
              styles.sendButton,
              (recorderState.isRecording ||
                (!message.trim() &&
                  !pendingAttachment) ||
                sending ||
                uploading) &&
                styles.sendButtonDisabled,
            ]}
            onPress={
              sendMessage
            }
          >
            {sending ||
            uploading ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.sendText
                }
              >
                ↑
              </Text>
            )}
          </Pressable>
        </View>

        <Modal
          visible={
            !!reactionTarget
          }
          transparent
          animationType="fade"
          onRequestClose={() =>
            setReactionTarget(
              null
            )
          }
        >
          <Pressable
            style={
              styles.reactionModalBackdrop
            }
            onPress={() =>
              setReactionTarget(
                null
              )
            }
          >
            <Pressable
              style={
                styles.reactionPickerCard
              }
              onPress={() => {}}
            >
              <Text
                style={
                  styles.reactionPickerTitle
                }
              >
                React
              </Text>

              <View
                style={
                  styles.reactionPickerGrid
                }
              >
                {[
                  '👍',
                  '❤️',
                  '😂',
                  '😮',
                  '😢',
                  '😡',
                  '🎉',
                  '🔥',
                  '👏',
                  '✅',
                  '🙏',
                  '💯',
                ].map(
                  (
                    emoji
                  ) => (
                    <Pressable
                      key={
                        emoji
                      }
                      style={
                        styles.reactionPickerEmojiButton
                      }
                      onPress={async () => {
                        if (
                          reactionTarget
                        ) {
                          await toggleReaction(
                            reactionTarget,
                            emoji
                          );
                        }

                        setReactionTarget(
                          null
                        );
                      }}
                    >
                      <Text
                        style={
                          styles.reactionPickerEmoji
                        }
                      >
                        {
                          emoji
                        }
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={
            !!fullScreenImageUrl
          }
          transparent={false}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() =>
            setFullScreenImageUrl(
              null
            )
          }
        >
          <SafeAreaView
            style={
              styles.imageViewerSafeArea
            }
          >
            <View
              style={
                styles.imageViewer
              }
            >
              <Pressable
                style={
                  styles.imageViewerClose
                }
                onPress={() =>
                  setFullScreenImageUrl(
                    null
                  )
                }
                hitSlop={12}
              >
                <Text
                  style={
                    styles.imageViewerCloseText
                  }
                >
                  ×
                </Text>
              </Pressable>

              {fullScreenImageUrl ? (
                <Image
                  source={{
                    uri:
                      fullScreenImageUrl,
                  }}
                  style={
                    styles.fullScreenImage
                  }
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </SafeAreaView>
        </Modal>
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

    mediaButton: {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      backgroundColor:
        '#F2F4F7',
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      alignItems: 'center',
      justifyContent:
        'center',
      marginLeft: 8,
    },

    mediaButtonText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
      color:
        '#4169E1',
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
      overflow: 'hidden',
    },

    avatarImage: {
      width: '100%',
      height: '100%',
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

    dateSeparator: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginVertical: 16,
      paddingHorizontal: 4,
    },

    dateSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor:
        '#EAECF0',
    },

    dateSeparatorText: {
      marginHorizontal: 12,
      fontSize: 12,
      fontWeight: '700',
      color:
        '#667085',
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

    attachmentImage: {
      width: 230,
      height: 180,
      borderRadius: 16,
      marginBottom: 5,
      backgroundColor:
        '#EAECF0',
    },

    receivedFileCard: {
      minWidth: 250,
      maxWidth: 300,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#EAECF0',
      borderRadius: 16,
      padding: 12,
      marginBottom: 5,
    },

    sentFileCard: {
      minWidth: 250,
      maxWidth: 300,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#3157C8',
      borderRadius: 16,
      padding: 12,
      marginBottom: 5,
    },

    receivedFileBadge: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
    },

    sentFileBadge: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor:
        'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.24)',
    },

    receivedFileBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      color:
        '#344054',
    },

    sentFileBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      color:
        '#FFFFFF',
    },

    fileInfo: {
      flex: 1,
    },

    receivedFileName: {
      fontSize: 14,
      fontWeight: '700',
      color: '#101828',
    },

    sentFileName: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    receivedFileMeta: {
      marginTop: 4,
      fontSize: 11,
      color: '#667085',
    },

    sentFileMeta: {
      marginTop: 4,
      fontSize: 11,
      color: '#DDE4FF',
    },

    receivedFileHint: {
      marginTop: 4,
      fontSize: 10,
      color: '#98A2B3',
    },

    sentFileHint: {
      marginTop: 4,
      fontSize: 10,
      color: '#DDE4FF',
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

    reactionModalBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(16,24,40,0.36)',
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 24,
    },

    reactionPickerCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 22,
      backgroundColor:
        '#FFFFFF',
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
      shadowColor:
        '#101828',
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 12,
    },

    reactionPickerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color:
        '#101828',
      marginBottom: 14,
    },

    reactionPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent:
        'space-between',
    },

    reactionPickerEmojiButton: {
      width: '15%',
      aspectRatio: 1,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent:
        'center',
      marginBottom: 10,
      backgroundColor:
        '#F9FAFB',
      borderWidth: 1,
      borderColor:
        '#EAECF0',
    },

    reactionPickerEmoji: {
      fontSize: 24,
    },

    reactionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 5,
    },

    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor:
        '#F2F4F7',
      borderWidth: 1,
      borderColor:
        '#EAECF0',
      marginRight: 5,
      marginBottom: 4,
    },

    reaction: {
      fontSize: 16,
    },

    reactionCount: {
      marginLeft: 4,
      fontSize: 11,
      fontWeight: '700',
      color:
        '#667085',
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

    pendingVoiceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#EEF2FF',
      borderTopWidth: 1,
      borderTopColor:
        '#D9E0FF',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    pendingVoicePlayButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#4169E1',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    pendingVoicePlayText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    pendingVoiceContent: {
      flex: 1,
    },

    pendingVoiceTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: '#344054',
    },

    pendingVoiceWave: {
      height: 26,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },

    pendingVoiceWaveBar: {
      width: 3,
      borderRadius: 2,
      backgroundColor:
        '#7F98EC',
      marginRight: 3,
    },

    pendingVoiceDuration: {
      marginTop: 2,
      fontSize: 11,
      color: '#667085',
    },

    pendingVoiceRemoveButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent:
        'center',
      marginLeft: 8,
    },

    pendingVoiceRemoveText: {
      fontSize: 26,
      lineHeight: 28,
      color: '#667085',
    },

    pendingAttachment: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#EEF2FF',
      borderTopWidth: 1,
      borderTopColor:
        '#D9E0FF',
      paddingHorizontal: 16,
      paddingVertical: 9,
    },

    pendingAttachmentInfo: {
      flex: 1,
    },

    pendingAttachmentLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#4169E1',
    },

    pendingAttachmentName: {
      marginTop: 2,
      fontSize: 13,
      color: '#344054',
    },

    removeAttachment: {
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
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor:
        '#EAECF0',
      backgroundColor:
        '#FFFFFF',
    },

    attachmentButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 8,
      backgroundColor:
        '#EEF2FF',
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        '#D9E0FF',
    },

    attachmentButtonText: {
      color: '#4169E1',
      fontSize: 28,
      lineHeight: 30,
      fontWeight: '500',
    },

    recordingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor:
        '#FFF4ED',
      borderTopWidth: 1,
      borderTopColor:
        '#FFD6AE',
    },

    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        '#D92D20',
      marginRight: 10,
    },

    recordingInfo: {
      flex: 1,
    },

    recordingLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#B42318',
    },

    recordingTime: {
      marginTop: 2,
      fontSize: 13,
      color: '#7A271A',
    },

    cancelRecordingButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginRight: 6,
    },

    cancelRecordingText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#667085',
    },

    stopRecordingButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor:
        '#D92D20',
    },

    stopRecordingText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    microphoneButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 8,
      backgroundColor:
        '#F2F4F7',
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    microphoneButtonRecording: {
      backgroundColor:
        '#FEE4E2',
      borderColor:
        '#FDA29B',
    },

    microphoneButtonText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '800',
      color: '#4169E1',
    },

    microphoneButtonTextRecording: {
      color: '#D92D20',
    },

    videoCard: {
      width: 250,
      height: 180,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor:
        '#000000',
      marginBottom: 5,
    },

    inlineVideo: {
      width: '100%',
      height: '100%',
    },

    receivedVoiceCard: {
      minWidth: 220,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#EAECF0',
      borderRadius: 18,
      padding: 12,
      marginBottom: 5,
    },

    sentVoiceCard: {
      minWidth: 220,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#4169E1',
      borderRadius: 18,
      padding: 12,
      marginBottom: 5,
    },

    receivedVoiceButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    sentVoiceButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    receivedVoiceButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#344054',
    },

    sentVoiceButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#4169E1',
    },

    voiceInfo: {
      flex: 1,
    },

    receivedVoiceTrack: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor:
        '#D0D5DD',
    },

    sentVoiceTrack: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor:
        '#7F98EC',
    },

    receivedVoiceProgress: {
      height: 4,
      borderRadius: 2,
      backgroundColor:
        '#667085',
    },

    sentVoiceProgress: {
      height: 4,
      borderRadius: 2,
      backgroundColor:
        '#FFFFFF',
    },

    receivedVoiceTime: {
      marginTop: 5,
      fontSize: 11,
      color: '#667085',
    },

    sentVoiceTime: {
      marginTop: 5,
      fontSize: 11,
      color: '#E0E7FF',
    },

    imageViewerSafeArea: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    imageViewer: {
      flex: 1,
      backgroundColor:
        '#000000',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    imageViewerClose: {
      position: 'absolute',
      top: 12,
      right: 18,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    imageViewerCloseText: {
      color: '#FFFFFF',
      fontSize: 32,
      lineHeight: 34,
      fontWeight: '400',
    },

    fullScreenImage: {
      width: '100%',
      height: '100%',
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
      marginLeft: 8,
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