import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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

type Profile = {
  id: string;
  display_name: string;
  username: string;
};

export default function FindUserScreen() {
  const {
    mode,
    conversationId,
  } = useLocalSearchParams<{
    mode?: string;
    conversationId?: string;
  }>();

  const addingToGroup =
    mode === 'add-to-group' &&
    !!conversationId;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [workingUserId, setWorkingUserId] =
    useState<string | null>(null);

  const searchUsers = async () => {
    const cleanQuery =
      query.trim().toLowerCase();

    if (cleanQuery.length < 2) {
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
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          'Not signed in',
          'Please sign in again.'
        );
        return;
      }

      const { data, error } =
        await supabase
          .from('profiles')
          .select(
            'id, display_name, username'
          )
          .ilike(
            'username',
            `%${cleanQuery}%`
          )
          .limit(20);

      if (error) {
        Alert.alert(
          'Search failed',
          error.message
        );
        return;
      }

      let filtered =
        (data ?? []).filter(
          (profile) =>
            profile.id !== user.id
        );

      if (
        addingToGroup &&
        conversationId
      ) {
        const {
          data: existingMembers,
          error: membersError,
        } = await supabase
          .from(
            'conversation_members'
          )
          .select('user_id')
          .eq(
            'conversation_id',
            conversationId
          );

        if (membersError) {
          Alert.alert(
            'Unable to check members',
            membersError.message
          );
          return;
        }

        const existingIds =
          new Set(
            (existingMembers ?? []).map(
              (member) =>
                member.user_id
            )
          );

        filtered =
          filtered.filter(
            (profile) =>
              !existingIds.has(
                profile.id
              )
          );
      }

      setResults(filtered);
    } catch (error) {
      console.error(
        'User search error:',
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

  const startConversation =
    async (
      profile: Profile
    ) => {
      try {
        setWorkingUserId(
          profile.id
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
          data: conversation,
          error:
            conversationError,
        } = await supabase
          .from(
            'conversations'
          )
          .insert({
            title:
              profile.display_name,
            is_group: false,
            created_by:
              user.id,
          })
          .select('id')
          .single();

        if (
          conversationError ||
          !conversation
        ) {
          Alert.alert(
            'Unable to start conversation',
            conversationError?.message ??
              'The conversation could not be created.'
          );
          return;
        }

        const {
          error: ownerError,
        } = await supabase
          .from(
            'conversation_members'
          )
          .insert({
            conversation_id:
              conversation.id,
            user_id:
              user.id,
            role: 'owner',
          });

        if (ownerError) {
          Alert.alert(
            'Unable to start conversation',
            ownerError.message
          );
          return;
        }

        const {
          error: memberError,
        } = await supabase
          .from(
            'conversation_members'
          )
          .insert({
            conversation_id:
              conversation.id,
            user_id:
              profile.id,
            role: 'member',
          });

        if (memberError) {
          Alert.alert(
            'Unable to add user',
            memberError.message
          );
          return;
        }

        router.replace({
          pathname:
            '/conversation',
          params: {
            conversationId:
              conversation.id,
          },
        });
      } catch (error) {
        console.error(
          'Start conversation error:',
          error
        );

        Alert.alert(
          'Unable to start conversation',
          'Please try again.'
        );
      } finally {
        setWorkingUserId(
          null
        );
      }
    };

  const addToGroup =
    async (
      profile: Profile
    ) => {
      if (!conversationId) {
        return;
      }

      try {
        setWorkingUserId(
          profile.id
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
          data: conversation,
          error:
            conversationError,
        } = await supabase
          .from(
            'conversations'
          )
          .select(
            'created_by, is_group'
          )
          .eq(
            'id',
            conversationId
          )
          .single();

        if (
          conversationError ||
          !conversation
        ) {
          Alert.alert(
            'Unable to load group',
            conversationError?.message ??
              'Group not found.'
          );
          return;
        }

        if (
          !conversation.is_group
        ) {
          Alert.alert(
            'Not a group',
            'This conversation is not a group chat.'
          );
          return;
        }

        if (
          conversation.created_by !==
          user.id
        ) {
          Alert.alert(
            'Owner only',
            'Only the group owner can add members.'
          );
          return;
        }

        const {
          error: memberError,
        } = await supabase
          .from(
            'conversation_members'
          )
          .insert({
            conversation_id:
              conversationId,
            user_id:
              profile.id,
            role: 'member',
          });

        if (memberError) {
          Alert.alert(
            'Unable to add member',
            memberError.message
          );
          return;
        }

        Alert.alert(
          'Member added',
          `${profile.display_name} was added to the group.`,
          [
            {
              text: 'OK',
              onPress: () =>
                router.back(),
            },
          ]
        );
      } catch (error) {
        console.error(
          'Add member error:',
          error
        );

        Alert.alert(
          'Unable to add member',
          'Please try again.'
        );
      } finally {
        setWorkingUserId(
          null
        );
      }
    };

  const handleUserPress =
    (
      profile: Profile
    ) => {
      if (addingToGroup) {
        addToGroup(profile);
      } else {
        startConversation(
          profile
        );
      }
    };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >
        <View
          style={styles.header}
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
            style={styles.title}
          >
            {addingToGroup
              ? 'Add Member'
              : 'Find User'}
          </Text>
        </View>

        <Text
          style={styles.subtitle}
        >
          {addingToGroup
            ? 'Search for someone to add to this group.'
            : 'Search by Project Delivered username.'}
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
            placeholder="Username"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={
              searchUsers
            }
          />

          <Pressable
            style={
              styles.searchButton
            }
            onPress={
              searchUsers
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
            style={styles.loader}
          />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(
              item
            ) => item.id}
            contentContainerStyle={
              results.length === 0
                ? styles.emptyList
                : undefined
            }
            ListEmptyComponent={
              <Text
                style={
                  styles.emptyText
                }
              >
                {addingToGroup
                  ? 'No available users to add.'
                  : 'No users to show yet.'}
              </Text>
            }
            renderItem={({
              item,
            }) => {
              const working =
                workingUserId ===
                item.id;

              return (
                <Pressable
                  style={
                    styles.result
                  }
                  disabled={
                    workingUserId !==
                    null
                  }
                  onPress={() =>
                    handleUserPress(
                      item
                    )
                  }
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
                      {item.display_name
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.userDetails
                    }
                  >
                    <Text
                      style={
                        styles.displayName
                      }
                    >
                      {
                        item.display_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.username
                      }
                    >
                      @{item.username}
                    </Text>
                  </View>

                  {working ? (
                    <ActivityIndicator
                      size="small"
                      color="#4169E1"
                    />
                  ) : (
                    <Text
                      style={
                        styles.actionLabel
                      }
                    >
                      {addingToGroup
                        ? 'Add'
                        : '›'}
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
      paddingHorizontal: 22,
      paddingTop: 18,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },

    backButton: {
      width: 36,
      marginRight: 6,
    },

    backText: {
      fontSize: 38,
      lineHeight: 40,
      color: '#4169E1',
    },

    title: {
      fontSize: 32,
      fontWeight: '800',
      color: '#101828',
    },

    subtitle: {
      fontSize: 16,
      lineHeight: 23,
      color: '#667085',
      marginBottom: 22,
    },

    searchRow: {
      flexDirection: 'row',
      marginBottom: 24,
    },

    input: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 16,
      color: '#101828',
      backgroundColor:
        '#FFFFFF',
    },

    searchButton: {
      marginLeft: 10,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor:
        '#4169E1',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    searchButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },

    loader: {
      marginTop: 30,
    },

    emptyList: {
      flexGrow: 1,
      justifyContent:
        'center',
    },

    emptyText: {
      textAlign: 'center',
      fontSize: 15,
      color: '#98A2B3',
    },

    result: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        '#E8ECFB',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 14,
    },

    avatarText: {
      fontSize: 19,
      fontWeight: '700',
      color: '#4169E1',
    },

    userDetails: {
      flex: 1,
    },

    displayName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#101828',
    },

    username: {
      marginTop: 3,
      fontSize: 14,
      color: '#667085',
    },

    actionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: '#4169E1',
    },
  });