import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ONBOARDING_KEY = 'project_delivered_onboarding_complete';

export default function HomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const onboardingComplete =
        await SecureStore.getItemAsync(ONBOARDING_KEY);

      if (onboardingComplete === 'true') {
        router.replace('/unlock');
        return;
      }
    } catch (error) {
      console.error('Unable to check onboarding state:', error);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4169E1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>PRIVATE MESSAGING</Text>

      <Text style={styles.title}>Project Delivered</Text>

      <Text style={styles.subtitle}>
        Conversations that matter, organised and easy to find.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/create-profile')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#F7F8FA',
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#4169E1',
    marginBottom: 14,
  },

  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 18,
  },

  subtitle: {
    fontSize: 19,
    lineHeight: 28,
    color: '#475467',
    marginBottom: 36,
  },

  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#4169E1',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 14,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});