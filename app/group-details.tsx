import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

type Member = {
  user_id: string;
  role: string;
  profile: {
    display_name: string;
    username: string;
  } | null;
};

export default function GroupDetailsScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId: string;
  }>();

  const [groupName, setGroupName] = useState('Group');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    loadGroupDetails();
  }, [conversationId]);

  const loadGroupDetails = async () => {
    try {
      setLoading(true);

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

      setCurrentUserId(user.id);

      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select('title, created_by, is_group')
        .eq('id', conversationId)
        .single();

      if (conversationError || !conversation) {
        Alert.alert(
          'Unable to load group',
          conversationError?.message ??
            'Group not found.'
        );
        return;
      }

      setGroupName(
        conversation.title ?? 'Group'
      );

      setIsOwner(
        conversation.created_by === user.id
      );

      const {
        data: memberRows,
        error: membersError,
      } = await supabase
        .from('conversation_members')
        .select('user_id, role')
        .eq(
          'conversation_id',
          conversationId
        );

      if (membersError) {
        Alert.alert(
          'Unable to load members',
          membersError.message
        );
        return;
      }

      const enrichedMembers =
        await Promise.all(
          (memberRows ?? []).map(
            async (member) => {
              const {
                data: profile,
              } = await supabase
                .from('profiles')
                .select(
                  'display_name, username'
                )
                .eq(
                  'id',
                  member.user_id
                )
                .maybeSingle();

              return {
                ...member,
                profile,
              };
            }
          )
        );

      setMembers(enrichedMembers);
    } catch (error) {
      console.error(
        'Load group details error:',
        error
      );

      Alert.alert(
        'Unable to load group',
        'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (
    member: Member
  ) => {
    if (!isOwner) {
      return;
    }

    if (member.user_id === currentUserId) {
      Alert.alert(
        'Owner cannot be removed',
        'Transfer ownership before removing yourself.'
      );
      return;
    }

    Alert.alert(
      'Remove Member',
      `Remove ${
        member.profile?.display_name ??
        'this user'
      } from the group?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } =
              await supabase
                .from(
                  'conversation_members'
                )
                .delete()
                .eq(
                  'conversation_id',
                  conversationId
                )
                .eq(
                  'user_id',
                  member.user_id
                );

            if (error) {
              Alert.alert(
                'Unable to remove member',
                error.message
              );
              return;
            }

            await loadGroupDetails();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
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

          <View>
            <Text style={styles.title}>
              {groupName}
            </Text>

            <Text style={styles.subtitle}>
              {members.length}{' '}
              {members.length === 1
                ? 'member'
                : 'members'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/find-user',
                params: {
                  mode: 'add-to-group',
                  conversationId,
                },
              })
            }
          >
            <Text
              style={styles.actionText}
            >
              Add Member
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>
          MEMBERS
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={styles.loader}
          />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) =>
              item.user_id
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.memberRow}
                onLongPress={() =>
                  removeMember(item)
                }
              >
                <View style={styles.avatar}>
                  <Text
                    style={styles.avatarText}
                  >
                    {(
                      item.profile
                        ?.display_name ??
                      '?'
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View style={styles.memberInfo}>
                  <Text
                    style={styles.memberName}
                  >
                    {item.profile
                      ?.display_name ??
                      'Unknown User'}
                  </Text>

                  <Text
                    style={styles.username}
                  >
                    @
                    {item.profile
                      ?.username ??
                      'unknown'}
                  </Text>
                </View>

                <Text
                  style={styles.role}
                >
                  {item.role === 'owner'
                    ? 'OWNER'
                    : ''}
                </Text>
              </Pressable>
            )}
          />
        )}

        {isOwner && (
          <Text style={styles.helpText}>
            Long-press a member to remove
            them from the group.
          </Text>
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
    marginBottom: 28,
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
    fontSize: 30,
    fontWeight: '800',
    color: '#101828',
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#667085',
  },

  actions: {
    marginBottom: 28,
  },

  actionButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#98A2B3',
    marginBottom: 10,
  },

  loader: {
    marginTop: 40,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8ECFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4169E1',
  },

  memberInfo: {
    flex: 1,
  },

  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
  },

  username: {
    marginTop: 3,
    fontSize: 13,
    color: '#667085',
  },

  role: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#4169E1',
  },

  helpText: {
    marginTop: 14,
    marginBottom: 20,
    fontSize: 12,
    color: '#98A2B3',
    textAlign: 'center',
  },
});