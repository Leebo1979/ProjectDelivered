import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const BIOMETRICS_KEY = 'project_delivered_biometrics_enabled';
const ONBOARDING_KEY = 'project_delivered_onboarding_complete';

export default function BiometricsScreen() {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const hasHardware =
        await LocalAuthentication.hasHardwareAsync();

      const isEnrolled =
        await LocalAuthentication.isEnrolledAsync();

      setAvailable(hasHardware && isEnrolled);
    } catch (error) {
      console.error(error);
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  const finishOnboarding = async (
    biometricsEnabled: boolean
  ) => {
    await SecureStore.setItemAsync(
      BIOMETRICS_KEY,
      biometricsEnabled ? 'true' : 'false'
    );

    await SecureStore.setItemAsync(
      ONBOARDING_KEY,
      'true'
    );

    router.replace('/chats');
  };

  const enableBiometrics = async () => {
    try {
      const result =
        await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable Face ID for Project Delivered',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use Passcode',
        });

      if (result.success) {
        await finishOnboarding(true);
      }
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Biometrics unavailable',
        'You can continue using your PIN.'
      );
    }
  };

  const skipBiometrics = async () => {
    try {
      await finishOnboarding(false);
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Unable to continue',
        'Please try again.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        APP SECURITY
      </Text>

      <Text style={styles.title}>
        Unlock Faster
      </Text>

      <Text style={styles.subtitle}>
        Use Face ID or Touch ID to unlock Project Delivered
        without entering your PIN each time.
      </Text>

      <View style={styles.icon}>
        <Text style={styles.iconText}>◎</Text>
      </View>

      <Pressable
        disabled={checking || !available}
        style={[
          styles.button,
          (checking || !available) &&
            styles.buttonDisabled,
        ]}
        onPress={enableBiometrics}
      >
        <Text style={styles.buttonText}>
          {checking
            ? 'Checking...'
            : available
              ? 'Enable Biometrics'
              : 'Biometrics Unavailable'}
        </Text>
      </Pressable>

      <Pressable onPress={skipBiometrics}>
        <Text style={styles.skipText}>
          Not Now
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
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
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 14,
  },

  subtitle: {
    fontSize: 18,
    lineHeight: 27,
    color: '#475467',
    marginBottom: 48,
  },

  icon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8ECFB',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },

  iconText: {
    fontSize: 60,
    color: '#4169E1',
  },

  button: {
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

  skipText: {
    textAlign: 'center',
    marginTop: 22,
    fontSize: 15,
    fontWeight: '600',
    color: '#4169E1',
  },
});