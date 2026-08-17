import {
    router,
    useLocalSearchParams,
} from 'expo-router';
import {
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type Conversation = {
  id: string;
  title: string | null;
  is_group: boolean;
};

type ConversationItem = {
  id: string;
  displayName: string;
  isGroup: boolean;
};

export default function ForwardMessageScreen() {
  const {
    messageId,
    sourceConversationId,
  } =
    useLocalSearchParams<{
      messageId: string;
      sourceConversationId: string;
    }>();

  const [
    conversations,
    setConversations,
  ] = useState<
    ConversationItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    forwardingId,
    setForwardingId,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadConversations();
  }, [
    sourceConversationId,
  ]);

  const loadConversations =
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
          Alert.alert(
            'Not signed in',
            'Please sign in again.'
          );
          return;
        }

        const {
          data: memberships,
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
            'user_id',
            user.id
          );

        if (
          membershipError
        ) {
          Alert.alert(
            'Unable to load conversations',
            membershipError.message
          );
          return;
        }

        const ids =
          (
            memberships ??
            []
          )
            .map(
              (item) =>
                item.conversation_id
            )
            .filter(
              (id) =>
                id !==
                sourceConversationId
            );

        if (
          ids.length === 0
        ) {
          setConversations(
            []
          );
          return;
        }

        const {
          data:
            conversationRows,
          error:
            conversationError,
        } = await supabase
          .from(
            'conversations'
          )
          .select(
            'id, title, is_group'
          )
          .in(
            'id',
            ids
          );

        if (
          conversationError
        ) {
          Alert.alert(
            'Unable to load conversations',
            conversationError.message
          );
          return;
        }

        const mappedResults =
          await Promise.all(
            (
              conversationRows ??
              []
            ).map(
              async (
                conversation:
                  Conversation
              ) => {
                let displayName =
                  conversation.title ??
                  'Conversation';

                if (
                  conversation.is_group
                ) {
                  return {
                    id:
                      conversation.id,
                    displayName,
                    isGroup: true,
                  } as ConversationItem;
                }

                const {
                  data:
                    members,
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
                  membersError
                ) {
                  console.error(
                    'Forward member load error:',
                    membersError
                  );
                  return null;
                }

                const other =
                  members?.find(
                    (
                      member
                    ) =>
                      member.user_id !==
                      user.id
                  );

                if (!other) {
                  return null;
                }

                const {
                  data:
                    profile,
                } =
                  await supabase
                    .from(
                      'profiles'
                    )
                    .select(
                      'display_name'
                    )
                    .eq(
                      'id',
                      other.user_id
                    )
                    .maybeSingle();

                if (
                  !profile
                ) {
                  return null;
                }

                displayName =
                  profile.display_name;

                return {
                  id:
                    conversation.id,
                  displayName,
                  isGroup: false,
                } as ConversationItem;
              }
            )
          );

        const mapped =
          mappedResults.filter(
            (
              item
            ): item is ConversationItem =>
              item !== null
          );

        mapped.sort(
          (a, b) =>
            a.displayName.localeCompare(
              b.displayName
            )
        );

        setConversations(
          mapped
        );
      } catch (error) {
        console.error(
          'Forward conversation load error:',
          error
        );

        Alert.alert(
          'Unable to load conversations',
          'Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  const forwardMessage =
    async (
      destinationConversationId:
        string
    ) => {
      if (
        !messageId ||
        forwardingId
      ) {
        return;
      }

      if (
        destinationConversationId ===
        sourceConversationId
      ) {
        Alert.alert(
          'Choose another conversation',
          'You cannot forward a message back into the same conversation.'
        );
        return;
      }

      try {
        setForwardingId(
          destinationConversationId
        );

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
          return;
        }

        const {
          data:
            destinationMembership,
          error:
            destinationMembershipError,
        } = await supabase
          .from(
            'conversation_members'
          )
          .select(
            'conversation_id'
          )
          .eq(
            'conversation_id',
            destinationConversationId
          )
          .eq(
            'user_id',
            user.id
          )
          .maybeSingle();

        if (
          destinationMembershipError ||
          !destinationMembership
        ) {
          Alert.alert(
            'Unable to forward message',
            destinationMembershipError
              ?.message ??
              'You are not a member of that conversation.'
          );
          return;
        }

        const {
          data:
            sourceMessage,
          error:
            sourceError,
        } = await supabase
          .from('messages')
          .select(
            `
            body,
            attachment_path,
            attachment_name,
            attachment_type,
            attachment_size
            `
          )
          .eq(
            'id',
            messageId
          )
          .is(
            'deleted_at',
            null
          )
          .maybeSingle();

        if (
          sourceError ||
          !sourceMessage
        ) {
          Alert.alert(
            'Unable to forward message',
            sourceError?.message ??
              'Message not found.'
          );
          return;
        }

        const {
          error:
            insertError,
        } = await supabase
          .from('messages')
          .insert({
            conversation_id:
              destinationConversationId,
            sender_id:
              user.id,
            body:
              sourceMessage.body,
            parent_message_id:
              null,
            attachment_path:
              sourceMessage.attachment_path,
            attachment_name:
              sourceMessage.attachment_name,
            attachment_type:
              sourceMessage.attachment_type,
            attachment_size:
              sourceMessage.attachment_size,
          });

        if (
          insertError
        ) {
          Alert.alert(
            'Unable to forward message',
            insertError.message
          );
          return;
        }

        router.replace({
          pathname:
            '/conversation',
          params: {
            conversationId:
              destinationConversationId,
          },
        });
      } catch (error) {
        console.error(
          'Forward message error:',
          error
        );

        Alert.alert(
          'Unable to forward message',
          'Please try again.'
        );
      } finally {
        setForwardingId(
          null
        );
      }
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
                styles.title
              }
            >
              Forward Message
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Choose another conversation
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={
              styles.loader
            }
          />
        ) : (
          <FlatList
            data={
              conversations
            }
            keyExtractor={(
              item
            ) =>
              item.id
            }
            contentContainerStyle={
              styles.list
            }
            ListEmptyComponent={
              <Text
                style={
                  styles.emptyText
                }
              >
                No other conversations available.
              </Text>
            }
            renderItem={({
              item,
            }) => {
              const isForwarding =
                forwardingId ===
                item.id;

              return (
                <Pressable
                  style={
                    styles.row
                  }
                  disabled={
                    !!forwardingId
                  }
                  onPress={() =>
                    forwardMessage(
                      item.id
                    )
                  }
                >
                  <View
                    style={[
                      styles.avatar,
                      item.isGroup &&
                        styles.groupAvatar,
                    ]}
                  >
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {item.displayName
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.info
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
                        item.displayName
                      }
                    </Text>

                    <Text
                      style={
                        styles.type
                      }
                    >
                      {item.isGroup
                        ? 'Group'
                        : 'Direct message'}
                    </Text>
                  </View>

                  {isForwarding ? (
                    <ActivityIndicator
                      size="small"
                      color="#4169E1"
                    />
                  ) : (
                    <Text
                      style={
                        styles.chevron
                      }
                    >
                      ›
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />
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
      paddingTop: 18,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 24,
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

    title: {
      fontSize: 28,
      fontWeight: '800',
      color:
        '#101828',
    },

    subtitle: {
      marginTop: 3,
      fontSize: 13,
      color:
        '#667085',
    },

    loader: {
      marginTop: 40,
    },

    list: {
      paddingBottom: 30,
    },

    row: {
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
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        '#E8ECFB',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 13,
    },

    groupAvatar: {
      backgroundColor:
        '#EAF7EF',
    },

    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color:
        '#4169E1',
    },

    info: {
      flex: 1,
    },

    name: {
      fontSize: 16,
      fontWeight: '700',
      color:
        '#101828',
    },

    type: {
      marginTop: 3,
      fontSize: 12,
      color:
        '#667085',
    },

    chevron: {
      fontSize: 26,
      color:
        '#98A2B3',
    },

    emptyText: {
      marginTop: 40,
      textAlign:
        'center',
      fontSize: 15,
      color:
        '#98A2B3',
    },
  });