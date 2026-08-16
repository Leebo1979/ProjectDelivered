import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function CreateProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const cleanUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');

  const canContinue =
    displayName.trim().length > 0 &&
    cleanUsername.length >= 3 &&
    !saving;

  const saveProfile = async () => {
    const cleanDisplayName = displayName.trim();

    if (!cleanDisplayName) {
      Alert.alert(
        'Display name required',
        'Please enter your display name.'
      );
      return;
    }

    if (cleanUsername.length < 3) {
      Alert.alert(
        'Username too short',
        'Please choose a username with at least 3 characters.'
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        Alert.alert(
          'Unable to load account',
          userError.message
        );
        return;
      }

      if (!user) {
        Alert.alert(
          'Not signed in',
          'Please create or sign in to your account again.'
        );
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            display_name: cleanDisplayName,
            username: cleanUsername,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        );

      if (error) {
        const errorMessage = error.message.toLowerCase();

        const usernameConflict =
          error.code === '23505' &&
          (
            errorMessage.includes('profiles_username_unique') ||
            errorMessage.includes('username')
          );

        if (usernameConflict) {
          Alert.alert(
            'Username unavailable',
            'That username is already being used by another account. Please choose another one.'
          );
          return;
        }

        console.error('Profile save error:', error);

        Alert.alert(
          'Unable to save profile',
          error.message
        );
        return;
      }

      router.push('/create-pin');
    } catch (error) {
      console.error('Profile save error:', error);

      Alert.alert(
        'Something went wrong',
        'Project Delivered could not save your profile. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>
          YOUR PROFILE
        </Text>

        <Text style={styles.title}>
          Create Your Profile
        </Text>

        <Text style={styles.subtitle}>
          Choose how you'll appear to other people in Project Delivered.
        </Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>

          <Pressable>
            <Text style={styles.photoAction}>
              Add profile photo
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Display Name
          </Text>

          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Lee"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Username
          </Text>

          <View style={styles.usernameRow}>
            <Text style={styles.atSymbol}>
              @
            </Text>

            <TextInput
              value={username}
              onChangeText={(text) =>
                setUsername(
                  text
                    .toLowerCase()
                    .replace(/[^a-z0-9._]/g, '')
                )
              }
              placeholder="lee"
              placeholderTextColor="#98A2B3"
              style={styles.usernameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.helper}>
            Other people will use this username to find and invite you.
          </Text>
        </View>

        <Pressable
          disabled={!canContinue}
          style={[
            styles.button,
            !canContinue && styles.buttonDisabled,
          ]}
          onPress={saveProfile}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Continue'}
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
    paddingHorizontal: 28,
    paddingTop: 36,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#4169E1',
    marginBottom: 12,
  },

  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 17,
    lineHeight: 25,
    color: '#475467',
    marginBottom: 30,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E4E7EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#667085',
  },

  photoAction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4169E1',
  },

  field: {
    marginBottom: 22,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
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
  },

  usernameRow: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },

  atSymbol: {
    fontSize: 17,
    color: '#667085',
    marginRight: 3,
  },

  usernameInput: {
    flex: 1,
    fontSize: 17,
    color: '#101828',
  },

  helper: {
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
    marginTop: 7,
  },

  button: {
    marginTop: 'auto',
    marginBottom: 28,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4169E1',
  },

  buttonDisabled: {
    opacity: 0.4,
  },

  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});