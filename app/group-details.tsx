import {
    router,
    useFocusEffect,
    useLocalSearchParams,
} from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
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
  const { conversationId } =
    useLocalSearchParams<{
      conversationId: string;
    }>();

  const [groupName, setGroupName] =
    useState('Group');

  const [members, setMembers] =
    useState<Member[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);

  const [isOwner, setIsOwner] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      loadGroupDetails();
    }, [conversationId])
  );

  const loadGroupDetails =
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

        setCurrentUserId(
          user.id
        );

        const {
          data: conversation,
          error:
            conversationError,
        } = await supabase
          .from('conversations')
          .select(
            'title, created_by, is_group'
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

        setGroupName(
          conversation.title ??
            'Group'
        );

        setIsOwner(
          conversation.created_by ===
            user.id
        );

        const {
          data: memberRows,
          error: membersError,
        } = await supabase
          .from(
            'conversation_members'
          )
          .select(
            'user_id, role'
          )
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
            (
              memberRows ?? []
            ).map(
              async (
                member
              ) => {
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

        enrichedMembers.sort(
          (a, b) => {
            if (
              a.role ===
              'owner'
            ) {
              return -1;
            }

            if (
              b.role ===
              'owner'
            ) {
              return 1;
            }

            const aName =
              a.profile
                ?.display_name ??
              '';

            const bName =
              b.profile
                ?.display_name ??
              '';

            return aName.localeCompare(
              bName
            );
          }
        );

        setMembers(
          enrichedMembers
        );
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

  const renameGroup = () => {
    if (!isOwner) {
      Alert.alert(
        'Owner only',
        'Only the group owner can rename this group.'
      );
      return;
    }

    if (
      Platform.OS !==
      'ios'
    ) {
      Alert.alert(
        'Rename Group',
        'Group renaming will use an inline editor on non-iOS builds.'
      );
      return;
    }

    Alert.prompt(
      'Rename Group',
      'Enter a new group name.',
      async (newName) => {
        const cleanName =
          newName?.trim();

        if (!cleanName) {
          return;
        }

        if (
          cleanName ===
          groupName
        ) {
          return;
        }

        const { error } =
          await supabase
            .from(
              'conversations'
            )
            .update({
              title:
                cleanName,
            })
            .eq(
              'id',
              conversationId
            );

        if (error) {
          Alert.alert(
            'Unable to rename group',
            error.message
          );
          return;
        }

        setGroupName(
          cleanName
        );
      },
      'plain-text',
      groupName
    );
  };

  const openAddMember =
    () => {
      if (!isOwner) {
        Alert.alert(
          'Owner only',
          'Only the group owner can add members.'
        );
        return;
      }

      router.push({
        pathname:
          '/find-user',
        params: {
          mode:
            'add-to-group',
          conversationId,
        },
      });
    };

  const removeMember =
    async (
      member: Member
    ) => {
      if (!isOwner) {
        return;
      }

      if (
        member.user_id ===
        currentUserId
      ) {
        Alert.alert(
          'Owner cannot be removed',
          'Transfer ownership before leaving the group.'
        );
        return;
      }

      Alert.alert(
        'Remove Member',
        `Remove ${
          member.profile
            ?.display_name ??
          'this user'
        } from the group?`,
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Remove',
            style:
              'destructive',
            onPress:
              async () => {
                const {
                  error,
                } =
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

                if (
                  error
                ) {
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

  const transferOwnership =
    (
      member: Member
    ) => {
      if (!isOwner) {
        return;
      }

      if (
        member.user_id ===
        currentUserId
      ) {
        return;
      }

      Alert.alert(
        'Transfer Ownership',
        `Make ${
          member.profile
            ?.display_name ??
          'this member'
        } the owner of ${groupName}?`,
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Transfer',
            onPress:
              async () => {
                const {
                  error,
                } =
                  await supabase.rpc(
                    'transfer_group_ownership',
                    {
                      target_conversation_id:
                        conversationId,
                      new_owner_id:
                        member.user_id,
                    }
                  );

                if (
                  error
                ) {
                  Alert.alert(
                    'Unable to transfer ownership',
                    error.message
                  );
                  return;
                }

                Alert.alert(
                  'Ownership transferred',
                  `${
                    member.profile
                      ?.display_name ??
                    'The member'
                  } is now the group owner.`
                );

                await loadGroupDetails();
              },
          },
        ]
      );
    };

  const showMemberActions =
    (
      member: Member
    ) => {
      if (!isOwner) {
        return;
      }

      if (
        member.user_id ===
        currentUserId
      ) {
        return;
      }

      Alert.alert(
        member.profile
          ?.display_name ??
          'Member',
        `@${
          member.profile
            ?.username ??
          'unknown'
        }`,
        [
          {
            text:
              'Transfer Ownership',
            onPress: () =>
              transferOwnership(
                member
              ),
          },
          {
            text:
              'Remove from Group',
            style:
              'destructive',
            onPress: () =>
              removeMember(
                member
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

  const leaveGroup =
    () => {
      if (
        !currentUserId
      ) {
        return;
      }

      if (isOwner) {
        Alert.alert(
          'Transfer ownership first',
          'You are the group owner. Transfer ownership to another member before leaving.'
        );
        return;
      }

      Alert.alert(
        'Leave Group',
        `Leave ${groupName}?`,
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Leave',
            style:
              'destructive',
            onPress:
              async () => {
                const {
                  error,
                } =
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
                      currentUserId
                    );

                if (
                  error
                ) {
                  Alert.alert(
                    'Unable to leave group',
                    error.message
                  );
                  return;
                }

                router.replace(
                  '/chats'
                );
              },
          },
        ]
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

          <View
            style={
              styles.headerText
            }
          >
            <Text
              style={
                styles.title
              }
              numberOfLines={
                1
              }
            >
              {groupName}
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              {members.length}{' '}
              {members.length ===
              1
                ? 'member'
                : 'members'}
            </Text>
          </View>
        </View>

        {isOwner && (
          <View
            style={
              styles.actions
            }
          >
            <Pressable
              style={
                styles.actionButton
              }
              onPress={
                renameGroup
              }
            >
              <Text
                style={
                  styles.actionText
                }
              >
                Rename Group
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionButton,
                styles.lastActionButton,
              ]}
              onPress={
                openAddMember
              }
            >
              <Text
                style={
                  styles.actionText
                }
              >
                Add Member
              </Text>
            </Pressable>
          </View>
        )}

        {!isOwner && (
          <View
            style={
              styles.memberNotice
            }
          >
            <Text
              style={
                styles.memberNoticeText
              }
            >
              Only the group owner can rename the group or manage members.
            </Text>
          </View>
        )}

        <Text
          style={
            styles.sectionTitle
          }
        >
          MEMBERS
        </Text>

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
            data={members}
            keyExtractor={(
              item
            ) =>
              item.user_id
            }
            contentContainerStyle={
              styles.memberList
            }
            renderItem={({
              item,
            }) => {
              const isCurrentUser =
                item.user_id ===
                currentUserId;

              return (
                <Pressable
                  style={
                    styles.memberRow
                  }
                  onLongPress={() =>
                    showMemberActions(
                      item
                    )
                  }
                  delayLongPress={
                    350
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
                      {(
                        item.profile
                          ?.display_name ??
                        '?'
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.memberInfo
                    }
                  >
                    <View
                      style={
                        styles.memberNameRow
                      }
                    >
                      <Text
                        style={
                          styles.memberName
                        }
                      >
                        {item.profile
                          ?.display_name ??
                          'Unknown User'}
                      </Text>

                      {isCurrentUser && (
                        <Text
                          style={
                            styles.youLabel
                          }
                        >
                          YOU
                        </Text>
                      )}
                    </View>

                    <Text
                      style={
                        styles.username
                      }
                    >
                      @
                      {item.profile
                        ?.username ??
                        'unknown'}
                    </Text>
                  </View>

                  {item.role ===
                    'owner' && (
                    <Text
                      style={
                        styles.role
                      }
                    >
                      OWNER
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />
        )}

        {isOwner && (
          <Text
            style={
              styles.helpText
            }
          >
            Long-press another member to transfer ownership or remove them.
          </Text>
        )}

        <Pressable
          style={
            styles.leaveButton
          }
          onPress={
            leaveGroup
          }
        >
          <Text
            style={
              styles.leaveButtonText
            }
          >
            Leave Group
          </Text>
        </Pressable>
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

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 30,
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

    actions: {
      flexDirection:
        'row',
      marginBottom: 24,
    },

    actionButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor:
        '#4169E1',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    lastActionButton: {
      marginRight: 0,
    },

    actionText: {
      fontSize: 15,
      fontWeight: '700',
      color:
        '#FFFFFF',
    },

    memberNotice: {
      backgroundColor:
        '#F2F4F7',
      borderRadius: 12,
      paddingHorizontal:
        14,
      paddingVertical:
        12,
      marginBottom: 22,
    },

    memberNoticeText: {
      fontSize: 13,
      lineHeight: 19,
      color:
        '#667085',
    },

    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.4,
      color:
        '#98A2B3',
      marginBottom: 10,
    },

    loader: {
      marginTop: 40,
    },

    memberList: {
      paddingBottom: 10,
    },

    memberRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical:
        13,
      borderBottomWidth:
        1,
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

    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color:
        '#4169E1',
    },

    memberInfo: {
      flex: 1,
    },

    memberNameRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    memberName: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '700',
      color:
        '#101828',
    },

    youLabel: {
      marginLeft: 7,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.6,
      color:
        '#4169E1',
      backgroundColor:
        '#EEF2FF',
      paddingHorizontal:
        5,
      paddingVertical: 2,
      borderRadius: 4,
    },

    username: {
      marginTop: 3,
      fontSize: 13,
      color:
        '#667085',
    },

    role: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
      color:
        '#4169E1',
    },

    helpText: {
      marginTop: 14,
      marginBottom: 12,
      fontSize: 12,
      color:
        '#98A2B3',
      textAlign:
        'center',
    },

    leaveButton: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#FDA29B',
      backgroundColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 'auto',
      marginBottom: 20,
    },

    leaveButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color:
        '#D92D20',
    },
  });