import { router } from 'expo-router';
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  const searchUsers = async () => {
    const cleanQuery = query.trim().toLowerCase();

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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .ilike('username', `%${cleanQuery}%`)
        .limit(20);

      if (error) {
        Alert.alert(
          'Search failed',
          error.message
        );
        return;
      }

      const filtered =
        (data ?? []).filter(
          (profile) => profile.id !== user.id
        );

      setResults(filtered);
    } catch (error) {
      console.error('User search error:', error);

      Alert.alert(
        'Search failed',
        'Please try again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const startConversation = async (
    profile: Profile
  ) => {
    try {
      setStartingChat(profile.id);

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

      //
      // Create the conversation.
      //
      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .insert({
          title: profile.display_name,
          is_group: false,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (conversationError || !conversation) {
        Alert.alert(
          'Unable to start conversation',
          conversationError?.message ??
            'The conversation could not be created.'
        );
        return;
      }

      //
      // Add the current user first.
      //
      const { error: ownerError } = await supabase
        .from('conversation_members')
        .insert({
          conversation_id: conversation.id,
          user_id: user.id,
          role: 'owner',
        });

      if (ownerError) {
        console.error(
          'Owner membership error:',
          ownerError
        );

        Alert.alert(
          'Unable to start conversation',
          ownerError.message
        );
        return;
      }

      //
      // Add the person we searched for.
      //
      const { error: memberError } = await supabase
        .from('conversation_members')
        .insert({
          conversation_id: conversation.id,
          user_id: profile.id,
          role: 'member',
        });

      if (memberError) {
        console.error(
          'Second membership error:',
          memberError
        );

        Alert.alert(
          'Unable to add user',
          memberError.message
        );
        return;
      }

      //
      // Open the new conversation.
      //
      router.replace({
        pathname: '/conversation',
        params: {
          conversationId: conversation.id,
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
      setStartingChat(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Find User
          </Text>
        </View>

        <Text style={styles.subtitle}>
          Search by Project Delivered username.
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Username"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={searchUsers}
          />

          <Pressable
            style={styles.searchButton}
            onPress={searchUsers}
            disabled={searching}
          >
            <Text style={styles.searchButtonText}>
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
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              results.length === 0
                ? styles.emptyList
                : undefined
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No users to show yet.
              </Text>
            }
            renderItem={({ item }) => {
              const isStarting =
                startingChat === item.id;

              return (
                <Pressable
                  style={styles.result}
                  disabled={startingChat !== null}
                  onPress={() =>
                    startConversation(item)
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.display_name
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userDetails}>
                    <Text style={styles.displayName}>
                      {item.display_name}
                    </Text>

                    <Text style={styles.username}>
                      @{item.username}
                    </Text>
                  </View>

                  {isStarting ? (
                    <ActivityIndicator
                      size="small"
                      color="#4169E1"
                    />
                  ) : (
                    <Text style={styles.chevron}>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
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
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#101828',
    backgroundColor: '#FFFFFF',
  },

  searchButton: {
    marginLeft: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
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
    borderBottomColor: '#EAECF0',
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8ECFB',
    alignItems: 'center',
    justifyContent: 'center',
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

  chevron: {
    fontSize: 28,
    color: '#98A2B3',
  },
});