import {
  router,
  Stack,
  useGlobalSearchParams,
  usePathname,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import 'react-native-reanimated';

import { supabase } from '../lib/supabase';

type IncomingMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_type: string | null;
};

type NotificationBanner = {
  conversationId: string;
  title: string;
  preview: string;
};

export default function RootLayout() {
  const pathname =
    usePathname();

  const {
    conversationId:
      currentConversationId,
  } =
    useGlobalSearchParams<{
      conversationId?: string;
    }>();

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(
    null
  );

  const [
    banner,
    setBanner,
  ] =
    useState<NotificationBanner | null>(
      null
    );

  const dismissTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  useEffect(() => {
    loadCurrentUser();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setCurrentUserId(
            session?.user.id ??
              null
          );
        }
      );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const messageChannel =
      supabase
        .channel(
          `global-message-notifications:${currentUserId}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (
            payload
          ) => {
            const newMessage =
              payload.new as IncomingMessage;

            await handleIncomingMessage(
              newMessage
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        messageChannel
      );
    };
  }, [
    currentUserId,
    pathname,
    currentConversationId,
  ]);

  useEffect(() => {
    return () => {
      if (
        dismissTimerRef.current
      ) {
        clearTimeout(
          dismissTimerRef.current
        );
      }
    };
  }, []);

  const loadCurrentUser =
    async () => {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      setCurrentUserId(
        user?.id ?? null
      );
    };

  const scheduleDismiss =
    () => {
      if (
        dismissTimerRef.current
      ) {
        clearTimeout(
          dismissTimerRef.current
        );
      }

      dismissTimerRef.current =
        setTimeout(() => {
          setBanner(null);
        }, 4500);
    };

  const handleIncomingMessage =
    async (
      newMessage:
        IncomingMessage
    ) => {
      if (
        !currentUserId ||
        newMessage.sender_id ===
          currentUserId
      ) {
        return;
      }

      const {
        data: membership,
        error:
          membershipError,
      } = await supabase
        .from(
          'conversation_members'
        )
        .select(
          'conversation_id'
        )
        .eq(
          'conversation_id',
          newMessage.conversation_id
        )
        .eq(
          'user_id',
          currentUserId
        )
        .maybeSingle();

      if (
        membershipError ||
        !membership
      ) {
        return;
      }

      const {
        data: mutedConversation,
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
          currentUserId
        )
        .eq(
          'conversation_id',
          newMessage.conversation_id
        )
        .maybeSingle();

      if (mutedError) {
        console.error(
          'Mute check error:',
          mutedError
        );
      }

      if (mutedConversation) {
        return;
      }

      const viewingThisConversation =
        pathname ===
          '/conversation' &&
        currentConversationId ===
          newMessage.conversation_id;

      if (
        viewingThisConversation
      ) {
        return;
      }

      const [
        senderResult,
        conversationResult,
      ] =
        await Promise.all([
          supabase
            .from('profiles')
            .select(
              'display_name'
            )
            .eq(
              'id',
              newMessage.sender_id
            )
            .maybeSingle(),

          supabase
            .from(
              'conversations'
            )
            .select(
              'title, is_group'
            )
            .eq(
              'id',
              newMessage.conversation_id
            )
            .maybeSingle(),
        ]);

      const senderName =
        senderResult.data
          ?.display_name ??
        'New message';

      const conversation =
        conversationResult.data;

      const title =
        conversation?.is_group
          ? conversation.title ??
            senderName
          : senderName;

      let preview =
        newMessage.body?.trim() ??
        '';

      if (
        newMessage.attachment_type
          ?.startsWith(
            'image/'
          )
      ) {
        preview =
          preview ||
          'Sent a photo';
      } else if (
        newMessage.attachment_type
          ?.startsWith(
            'audio/'
          )
      ) {
        preview =
          'Sent a voice message';
      } else if (
        newMessage.attachment_type
      ) {
        preview =
          preview ||
          'Sent an attachment';
      }

      if (!preview) {
        preview =
          'New message';
      }

      if (
        conversation?.is_group
      ) {
        preview =
          `${senderName}: ${preview}`;
      }

      setBanner({
        conversationId:
          newMessage.conversation_id,
        title,
        preview,
      });

      scheduleDismiss();
    };

  const openBannerConversation =
    () => {
      if (!banner) {
        return;
      }

      const targetConversationId =
        banner.conversationId;

      setBanner(null);

      if (
        dismissTimerRef.current
      ) {
        clearTimeout(
          dismissTimerRef.current
        );

        dismissTimerRef.current =
          null;
      }

      router.push({
        pathname:
          '/conversation',
        params: {
          conversationId:
            targetConversationId,
        },
      });
    };

  return (
    <View
      style={
        styles.root
      }
    >
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
        />

        <Stack.Screen
          name="sign-up"
        />

        <Stack.Screen
          name="create-profile"
        />

        <Stack.Screen
          name="create-pin"
        />

        <Stack.Screen
          name="biometrics"
        />

        <Stack.Screen
          name="unlock"
        />

        <Stack.Screen
          name="chats"
        />

        <Stack.Screen
          name="conversation"
        />

        <Stack.Screen
          name="find-user"
        />

        <Stack.Screen
          name="create-group"
        />

        <Stack.Screen
          name="group-details"
        />

        <Stack.Screen
          name="favourites"
        />

        <Stack.Screen
          name="search-messages"
        />

        <Stack.Screen
          name="forward-message"
        />

        <Stack.Screen
          name="archived-chats"
        />

        <Stack.Screen
          name="modal"
        />
      </Stack>

      {banner && (
        <View
          pointerEvents="box-none"
          style={
            styles.bannerLayer
          }
        >
          <Pressable
            style={
              styles.banner
            }
            onPress={
              openBannerConversation
            }
          >
            <View
              style={
                styles.bannerAvatar
              }
            >
              <Text
                style={
                  styles.bannerAvatarText
                }
              >
                {banner.title
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={
                styles.bannerContent
              }
            >
              <Text
                style={
                  styles.bannerTitle
                }
                numberOfLines={
                  1
                }
              >
                {
                  banner.title
                }
              </Text>

              <Text
                style={
                  styles.bannerPreview
                }
                numberOfLines={
                  2
                }
              >
                {
                  banner.preview
                }
              </Text>
            </View>

            <Pressable
              style={
                styles.closeButton
              }
              onPress={(
                event
              ) => {
                event.stopPropagation();

                setBanner(
                  null
                );

                if (
                  dismissTimerRef.current
                ) {
                  clearTimeout(
                    dismissTimerRef.current
                  );

                  dismissTimerRef.current =
                    null;
                }
              }}
            >
              <Text
                style={
                  styles.closeText
                }
              >
                ×
              </Text>
            </Pressable>
          </Pressable>
        </View>
      )}

      <StatusBar
        style="dark"
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor:
        '#F7F8FA',
    },

    bannerLayer: {
      position:
        'absolute',
      top: 54,
      left: 12,
      right: 12,
      zIndex: 9999,
      elevation: 20,
    },

    banner: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight: 74,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#EAECF0',

      shadowColor:
        '#101828',
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 5,
      },

      elevation: 8,
    },

    bannerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#E8ECFB',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    bannerAvatarText: {
      fontSize: 17,
      fontWeight: '800',
      color:
        '#4169E1',
    },

    bannerContent: {
      flex: 1,
      paddingRight: 8,
    },

    bannerTitle: {
      fontSize: 15,
      fontWeight: '800',
      color:
        '#101828',
    },

    bannerPreview: {
      marginTop: 3,
      fontSize: 13,
      lineHeight: 17,
      color:
        '#667085',
    },

    closeButton: {
      width: 32,
      height: 32,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    closeText: {
      fontSize: 24,
      lineHeight: 26,
      color:
        '#98A2B3',
    },
  });