import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function SignUpScreen() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        router.replace('/create-profile');
        return;
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setCheckingSession(false);
    }
  };

  const createAccount = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert(
        'Email required',
        'Please enter your email address.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Password too short',
        'Please use at least 8 characters.'
      );
      return;
    }

    try {
      setCreating(true);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        Alert.alert(
          'Unable to create account',
          error.message
        );
        return;
      }

      if (!data.user) {
        Alert.alert(
          'Account not created',
          'Please try again.'
        );
        return;
      }

      router.replace('/create-profile');
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Something went wrong',
        'Please try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4169E1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>CREATE ACCOUNT</Text>

        <Text style={styles.title}>
          Join Project Delivered
        </Text>

        <Text style={styles.subtitle}>
          Create an account so your profile and conversations can sync securely between devices.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#98A2B3"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Pressable
          disabled={creating}
          style={[
            styles.button,
            creating && styles.buttonDisabled,
          ]}
          onPress={createAccount}
        >
          <Text style={styles.buttonText}>
            {creating ? 'Creating...' : 'Create Account'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#4169E1',
    marginBottom: 14,
  },

  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 14,
  },

  subtitle: {
    fontSize: 17,
    lineHeight: 25,
    color: '#475467',
    marginBottom: 36,
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

  button: {
    height: 54,
    marginTop: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4169E1',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});