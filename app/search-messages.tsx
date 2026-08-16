import {
    router,
} from 'expo-router';
import {
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
    TextInput,
    View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type SearchResult = {
  messageId: string;
  conversationId: string;
  body: string;
  createdAt: string;
  conversationName: string;
};

export default function SearchMessagesScreen() {
  const [query, setQuery] =
    useState('');

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [searching, setSearching] =
    useState(false);

  const searchMessages =
    async () => {
      const cleanQuery =
        query.trim();

      if (
        cleanQuery.length < 2
      ) {
        Alert.alert(
          'Search',
          'Enter at least 2 characters.'
        );
        return;
      }

      try {
        setSearching(true);

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
            'Search failed',
            membershipError.message
          );
          return;
        }

        const conversationIds =
          (
            memberships ??
            []
          ).map(
            (item) =>
              item.conversation_id
          );

        if (
          conversationIds.length ===
          0
        ) {
          setResults([]);
          return;
        }

        const {
          data: messages,
          error:
            messagesError,
        } = await supabase
          .from('messages')
          .select(
            `
            id,
            body,
            conversation_id,
            created_at
            `
          )
          .in(
            'conversation_id',
            conversationIds
          )
          .is(
            'deleted_at',
            null
          )
          .ilike(
            'body',
            `%${cleanQuery}%`
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          )
          .limit(100);

        if (
          messagesError
        ) {
          Alert.alert(
            'Search failed',
            messagesError.message
          );
          return;
        }

        const mappedResults =
          await Promise.all(
            (
              messages ??
              []
            ).map(
              async (
                item
              ) => {
                const {
                  data:
                    conversation,
                } =
                  await supabase
                    .from(
                      'conversations'
                    )
                    .select(
                      'title, is_group'
                    )
                    .eq(
                      'id',
                      item.conversation_id
                    )
                    .maybeSingle();

                let conversationName =
                  conversation
                    ?.title ??
                  'Conversation';

                if (
                  conversation &&
                  !conversation.is_group
                ) {
                  const {
                    data:
                      members,
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
                        item.conversation_id
                      );

                  const otherMember =
                    members?.find(
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
                          otherMember.user_id
                        )
                        .maybeSingle();

                    if (
                      profile
                    ) {
                      conversationName =
                        profile.display_name;
                    }
                  }
                }

                return {
                  messageId:
                    item.id,

                  conversationId:
                    item.conversation_id,

                  body:
                    item.body,

                  createdAt:
                    item.created_at,

                  conversationName,
                };
              }
            )
          );

        setResults(
          mappedResults
        );
      } catch (error) {
        console.error(
          'Message search error:',
          error
        );

        Alert.alert(
          'Search failed',
          'Please try again.'
        );
      } finally {
        setSearching(false);
      }
    };

  const formatDate = (
    timestamp: string
  ) => {
    const date =
      new Date(timestamp);

    return date.toLocaleString(
      [],
      {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
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

          <Text
            style={
              styles.title
            }
          >
            Search Messages
          </Text>
        </View>

        <Text
          style={
            styles.subtitle
          }
        >
          Search across conversations you belong to.
        </Text>

        <View
          style={
            styles.searchRow
          }
        >
          <TextInput
            value={query}
            onChangeText={
              setQuery
            }
            placeholder="Search messages"
            placeholderTextColor="#98A2B3"
            style={
              styles.input
            }
            returnKeyType="search"
            onSubmitEditing={
              searchMessages
            }
          />

          <Pressable
            style={
              styles.searchButton
            }
            onPress={
              searchMessages
            }
            disabled={
              searching
            }
          >
            <Text
              style={
                styles.searchButtonText
              }
            >
              Search
            </Text>
          </Pressable>
        </View>

        {searching ? (
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
              results
            }
            keyExtractor={(
              item
            ) =>
              item.messageId
            }
            contentContainerStyle={
              results.length ===
              0
                ? styles.emptyList
                : styles.list
            }
            ListEmptyComponent={
              <Text
                style={
                  styles.emptyText
                }
              >
                No matching messages.
              </Text>
            }
            renderItem={({
              item,
            }) => (
              <Pressable
                style={
                  styles.resultCard
                }
                onPress={() =>
                  router.push({
                    pathname:
                      '/conversation',
                    params: {
                      conversationId:
                        item.conversationId,
                    },
                  })
                }
              >
                <View
                  style={
                    styles.resultHeader
                  }
                >
                  <Text
                    style={
                      styles.conversationName
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      item.conversationName
                    }
                  </Text>

                  <Text
                    style={
                      styles.date
                    }
                  >
                    {formatDate(
                      item.createdAt
                    )}
                  </Text>
                </View>

                <Text
                  style={
                    styles.messageText
                  }
                  numberOfLines={
                    3
                  }
                >
                  {item.body}
                </Text>
              </Pressable>
            )}
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
      marginBottom: 12,
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
      fontSize: 30,
      fontWeight: '800',
      color:
        '#101828',
    },

    subtitle: {
      fontSize: 16,
      lineHeight: 23,
      color:
        '#667085',
      marginBottom: 22,
    },

    searchRow: {
      flexDirection:
        'row',
      marginBottom: 22,
    },

    input: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      borderRadius: 12,
      paddingHorizontal:
        14,
      fontSize: 16,
      color:
        '#101828',
      backgroundColor:
        '#FFFFFF',
    },

    searchButton: {
      marginLeft: 10,
      paddingHorizontal:
        18,
      borderRadius: 12,
      backgroundColor:
        '#4169E1',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    searchButtonText: {
      color:
        '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },

    loader: {
      marginTop: 30,
    },

    list: {
      paddingBottom: 30,
    },

    emptyList: {
      flexGrow: 1,
      justifyContent:
        'center',
    },

    emptyText: {
      textAlign:
        'center',
      fontSize: 15,
      color:
        '#98A2B3',
    },

    resultCard: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    resultHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 7,
    },

    conversationName: {
      flex: 1,
      marginRight: 12,
      fontSize: 16,
      fontWeight: '700',
      color:
        '#101828',
    },

    date: {
      fontSize: 11,
      color:
        '#98A2B3',
    },

    messageText: {
      fontSize: 15,
      lineHeight: 21,
      color:
        '#475467',
    },
  });