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

export default function SignUpScreen() {
  const [mode, setMode] =
    useState<'sign-in' | 'sign-up'>('sign-in');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);

  const routeAfterAuthentication = async (
    userId: string
  ) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(
        'Profile lookup error:',
        error
      );

      Alert.alert(
        'Unable to load profile',
        error.message
      );

      return;
    }

    if (profile) {
      router.replace('/chats');
    } else {
      router.replace('/create-profile');
    }
  };

  const submit = async () => {
    const cleanEmail =
      email.trim().toLowerCase();

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
      setWorking(true);

      if (mode === 'sign-in') {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) {
          Alert.alert(
            'Unable to sign in',
            error.message
          );

          return;
        }

        if (!data.session?.user) {
          Alert.alert(
            'Sign in failed',
            'No active session was returned.'
          );

          return;
        }

        await routeAfterAuthentication(
          data.session.user.id
        );

        return;
      }

      const { data, error } =
        await supabase.auth.signUp({
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

      if (!data.session?.user) {
        Alert.alert(
          'Account created',
          'Your account was created, but no active session was returned.'
        );

        return;
      }

      await routeAfterAuthentication(
        data.session.user.id
      );
    } catch (error) {
      console.error(
        'Authentication error:',
        error
      );

      Alert.alert(
        'Something went wrong',
        'Please try again.'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>
          PROJECT DELIVERED
        </Text>

        <Text style={styles.title}>
          {mode === 'sign-in'
            ? 'Sign In'
            : 'Create Account'}
        </Text>

        <Text style={styles.subtitle}>
          {mode === 'sign-in'
            ? 'Sign in to continue to your conversations.'
            : 'Create an account so your profile and conversations can sync securely.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>
            Email
          </Text>

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
          <Text style={styles.label}>
            Password
          </Text>

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
          disabled={working}
          style={[
            styles.button,
            working &&
              styles.buttonDisabled,
          ]}
          onPress={submit}
        >
          <Text style={styles.buttonText}>
            {working
              ? 'Please wait...'
              : mode === 'sign-in'
                ? 'Sign In'
                : 'Create Account'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setMode(
              mode === 'sign-in'
                ? 'sign-up'
                : 'sign-in'
            )
          }
        >
          <Text style={styles.switchText}>
            {mode === 'sign-in'
              ? 'Need an account? Create one'
              : 'Already have an account? Sign in'}
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

  switchText: {
    marginTop: 22,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#4169E1',
  },
});