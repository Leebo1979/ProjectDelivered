import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function CreateProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  const canContinue =
    displayName.trim().length > 0 && username.trim().length >= 3;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>YOUR PROFILE</Text>

        <Text style={styles.title}>Create Your Profile</Text>

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
            <Text style={styles.photoAction}>Add profile photo</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Display Name</Text>

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
          <Text style={styles.label}>Username</Text>

          <View style={styles.usernameRow}>
            <Text style={styles.atSymbol}>@</Text>

            <TextInput
              value={username}
              onChangeText={(text) =>
                setUsername(
                  text.toLowerCase().replace(/[^a-z0-9._]/g, '')
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
            This is how other people will find and invite you.
          </Text>
        </View>

        <Pressable
          disabled={!canContinue}
          style={[
            styles.button,
            !canContinue && styles.buttonDisabled,
          ]}
          onPress={() => router.push('/create-pin')}
        >
          <Text style={styles.buttonText}>Continue</Text>
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