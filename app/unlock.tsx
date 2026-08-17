import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const PIN_STORAGE_KEY = 'project_delivered_pin';
const BIOMETRICS_KEY = 'project_delivered_biometrics_enabled';

function derivePinValue(pin: string) {
  return pin
    .split('')
    .map((digit, index) => {
      const value = Number(digit);
      return ((value + index + 3) % 10).toString();
    })
    .reverse()
    .join('');
}

export default function UnlockScreen() {
  const [pin, setPin] = useState('');
  const [checkingBiometrics, setCheckingBiometrics] = useState(true);

  useEffect(() => {
    tryBiometricUnlock();
  }, []);

  const tryBiometricUnlock = async () => {
    try {
      const biometricsEnabled =
        await SecureStore.getItemAsync(BIOMETRICS_KEY);

      if (biometricsEnabled !== 'true') {
        setCheckingBiometrics(false);
        return;
      }

      const result =
        await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Project Delivered',
          cancelLabel: 'Use PIN',
          fallbackLabel: 'Use PIN',
        });

      if (result.success) {
        router.replace('/chats');
        return;
      }
    } catch (error) {
      console.error(error);
    }

    setCheckingBiometrics(false);
  };

  const handlePinUnlock = async () => {
    if (pin.length !== 6) {
      Alert.alert(
        'PIN required',
        'Please enter your 6-digit PIN.'
      );
      return;
    }

    const savedPin =
      await SecureStore.getItemAsync(PIN_STORAGE_KEY);

    const enteredPin = derivePinValue(pin);

    if (savedPin === enteredPin) {
      router.replace('/chats');
    } else {
      setPin('');

      Alert.alert(
        'Incorrect PIN',
        'The PIN you entered is incorrect.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        PROJECT DELIVERED
      </Text>

      <Text style={styles.title}>
        Unlock
      </Text>

      <Text style={styles.subtitle}>
        Use Face ID or enter your 6-digit PIN.
      </Text>

      <View style={styles.pinDisplay}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < pin.length &&
                styles.pinDotFilled,
            ]}
          />
        ))}
      </View>

      <TextInput
        value={pin}
        onChangeText={(text) =>
          setPin(
            text
              .replace(/[^0-9]/g, '')
              .slice(0, 6)
          )
        }
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        style={styles.hiddenInput}
      />

      <Pressable
        disabled={pin.length !== 6}
        style={[
          styles.button,
          pin.length !== 6 &&
            styles.buttonDisabled,
        ]}
        onPress={handlePinUnlock}
      >
        <Text style={styles.buttonText}>
          Unlock with PIN
        </Text>
      </Pressable>

      <Pressable
        onPress={tryBiometricUnlock}
        disabled={checkingBiometrics}
      >
        <Text style={styles.biometricText}>
          {checkingBiometrics
            ? 'Checking Face ID...'
            : 'Use Face ID'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 100,
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

  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 36,
  },

  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#98A2B3',
    backgroundColor: '#FFFFFF',
  },

  pinDotFilled: {
    backgroundColor: '#4169E1',
    borderColor: '#4169E1',
  },

  hiddenInput: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 20,
    letterSpacing: 8,
    color: '#101828',
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  biometricText: {
    textAlign: 'center',
    marginTop: 22,
    fontSize: 15,
    fontWeight: '600',
    color: '#4169E1',
  },
});