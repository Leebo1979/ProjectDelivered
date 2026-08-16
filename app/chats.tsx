import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
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

type Conversation = {
  id: string;
  title: string | null;
  is_group: boolean;
  created_at: string;
};

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
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
        setConversations([]);
        return;
      }

      const { data, error } = await supabase
        .from('conversations')
        .select(
          'id, title, is_group, created_at'
        )
        .in('id', conversationIds)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        Alert.alert(
          'Unable to load chats',
          error.message
        );
        return;
      }

      setConversations(data ?? []);
    } catch (error) {
      console.error(
        'Load conversations error:',
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

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
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

        <Text style={styles.sectionTitle}>
          RECENT
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={styles.loader}
          />
        ) : conversations.length === 0 ? (
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
          conversations.map(
            (conversation) => (
              <Pressable
                key={conversation.id}
                style={styles.chat}
                onPress={() =>
                  router.push({
                    pathname:
                      '/conversation',
                    params: {
                      conversationId:
                        conversation.id,
                    },
                  })
                }
              >
                <View
                  style={styles.avatar}
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {(
                      conversation.title ??
                      'C'
                    )
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
                    <Text
                      style={styles.name}
                    >
                      {conversation.title ??
                        'Conversation'}
                    </Text>

                    <Text
                      style={styles.time}
                    >
                      {new Date(
                        conversation.created_at
                      ).toLocaleDateString()}
                    </Text>
                  </View>

                  <Text
                    style={styles.preview}
                    numberOfLines={1}
                  >
                    Open conversation
                  </Text>
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
            style={styles.devButton}
            onPress={signOut}
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
            style={styles.devButton}
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
    marginBottom: 5,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#101828',
  },

  time: {
    fontSize: 12,
    color: '#98A2B3',
  },

  preview: {
    fontSize: 15,
    color: '#667085',
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