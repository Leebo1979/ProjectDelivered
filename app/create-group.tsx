import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function CreateGroupScreen() {
  const [groupName, setGroupName] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .neq('id', user.id)
        .order('display_name');

      if (error) {
        Alert.alert(
          'Unable to load users',
          error.message
        );
        return;
      }

      setProfiles(data ?? []);
    } catch (error) {
      console.error(
        'Load profiles error:',
        error
      );

      Alert.alert(
        'Unable to load users',
        'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedIds((current) => {
      if (current.includes(userId)) {
        return current.filter(
          (id) => id !== userId
        );
      }

      return [...current, userId];
    });
  };

  const createGroup = async () => {
    const cleanName = groupName.trim();

    if (!cleanName) {
      Alert.alert(
        'Group name required',
        'Please give your group a name.'
      );
      return;
    }

    if (selectedIds.length < 1) {
      Alert.alert(
        'Choose members',
        'Select at least one other person.'
      );
      return;
    }

    try {
      setCreating(true);

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

      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .insert({
          title: cleanName,
          is_group: true,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (conversationError || !conversation) {
        Alert.alert(
          'Unable to create group',
          conversationError?.message ??
            'Please try again.'
        );
        return;
      }

      const members = [
        {
          conversation_id: conversation.id,
          user_id: user.id,
          role: 'owner',
        },
        ...selectedIds.map((userId) => ({
          conversation_id: conversation.id,
          user_id: userId,
          role: 'member',
        })),
      ];

      const { error: membersError } =
        await supabase
          .from('conversation_members')
          .insert(members);

      if (membersError) {
        Alert.alert(
          'Unable to add group members',
          membersError.message
        );
        return;
      }

      const { error: messageError } =
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            body: `Group "${cleanName}" created`,
          });

      if (messageError) {
        console.error(
          'Initial group message error:',
          messageError
        );
      }

      router.replace({
        pathname: '/conversation',
        params: {
          conversationId: conversation.id,
        },
      });
    } catch (error) {
      console.error(
        'Create group error:',
        error
      );

      Alert.alert(
        'Unable to create group',
        'Please try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    groupName.trim().length > 0 &&
    selectedIds.length > 0 &&
    !creating;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.title}>
            New Group
          </Text>
        </View>

        <Text style={styles.label}>
          Group name
        </Text>

        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g. Project Team"
          placeholderTextColor="#98A2B3"
          style={styles.input}
          maxLength={50}
        />

        <View style={styles.memberHeader}>
          <Text style={styles.memberTitle}>
            Add people
          </Text>

          <Text style={styles.selectedCount}>
            {selectedIds.length} selected
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={styles.loader}
          />
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No other users found.
              </Text>
            }
            renderItem={({ item }) => {
              const selected =
                selectedIds.includes(item.id);

              return (
                <Pressable
                  style={styles.userRow}
                  onPress={() =>
                    toggleUser(item.id)
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.display_name
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.displayName}>
                      {item.display_name}
                    </Text>

                    <Text style={styles.username}>
                      @{item.username}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.selectionCircle,
                      selected &&
                        styles.selectionCircleSelected,
                    ]}
                  >
                    {selected && (
                      <Text style={styles.check}>
                        ✓
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <Pressable
          disabled={!canCreate}
          style={[
            styles.createButton,
            !canCreate &&
              styles.createButtonDisabled,
          ]}
          onPress={createGroup}
        >
          <Text style={styles.createButtonText}>
            {creating
              ? 'Creating...'
              : 'Create Group'}
          </Text>
        </Pressable>
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
    marginBottom: 26,
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

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#101828',
    backgroundColor: '#FFFFFF',
    marginBottom: 28,
  },

  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  memberTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
  },

  selectedCount: {
    fontSize: 13,
    color: '#667085',
  },

  loader: {
    marginTop: 40,
  },

  list: {
    flex: 1,
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#98A2B3',
  },

  userRow: {
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

  userInfo: {
    flex: 1,
  },

  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
  },

  username: {
    marginTop: 3,
    fontSize: 13,
    color: '#667085',
  },

  selectionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectionCircleSelected: {
    backgroundColor: '#4169E1',
    borderColor: '#4169E1',
  },

  check: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  createButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#4169E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 20,
  },

  createButtonDisabled: {
    opacity: 0.4,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});