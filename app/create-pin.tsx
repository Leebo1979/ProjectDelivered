import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const PIN_STORAGE_KEY = 'project_delivered_pin';

function derivePinValue(pin: string) {
  // Prototype-only transformation.
  // We will strengthen PIN credential handling before production.
  return pin
    .split('')
    .map((digit, index) => {
      const value = Number(digit);
      return ((value + index + 3) % 10).toString();
    })
    .reverse()
    .join('');
}

export default function CreatePinScreen() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [saving, setSaving] = useState(false);

  const activeValue = step === 'create' ? pin : confirmPin;

  const updateActiveValue = (text: string) => {
    const digitsOnly = text
      .replace(/[^0-9]/g, '')
      .slice(0, 6);

    if (step === 'create') {
      setPin(digitsOnly);
    } else {
      setConfirmPin(digitsOnly);
    }
  };

  const handleCreatePin = () => {
    if (pin.length !== 6) {
      Alert.alert(
        'PIN required',
        'Please enter a 6-digit PIN.'
      );
      return;
    }

    setConfirmPin('');
    setStep('confirm');
  };

  const handleConfirmPin = async () => {
    if (confirmPin.length !== 6) {
      Alert.alert(
        'PIN required',
        'Please confirm your 6-digit PIN.'
      );
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert(
        'PINs do not match',
        'Please enter the same PIN again.'
      );

      setConfirmPin('');
      return;
    }

    try {
      setSaving(true);

      const derivedPin = derivePinValue(pin);

      await SecureStore.setItemAsync(
        PIN_STORAGE_KEY,
        derivedPin
      );

      // PIN saved successfully.
      // Move directly to biometric setup.
      router.replace('/biometrics');
    } catch (error) {
      console.error('PIN save error:', error);

      Alert.alert(
        'Unable to save PIN',
        'Project Delivered could not save your PIN. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const resetPin = () => {
    setPin('');
    setConfirmPin('');
    setStep('create');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.eyebrow}>
          APP SECURITY
        </Text>

        <Text style={styles.title}>
          {step === 'create'
            ? 'Create Your PIN'
            : 'Confirm Your PIN'}
        </Text>

        <Text style={styles.subtitle}>
          {step === 'create'
            ? 'Choose a 6-digit PIN to protect Project Delivered on this device.'
            : 'Enter the same PIN again to confirm it.'}
        </Text>

        <View style={styles.pinDisplay}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                index < activeValue.length &&
                  styles.pinDotFilled,
              ]}
            />
          ))}
        </View>

        <TextInput
          value={activeValue}
          onChangeText={updateActiveValue}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          autoFocus
          style={styles.hiddenInput}
        />

        <Pressable
          disabled={
            activeValue.length !== 6 || saving
          }
          style={[
            styles.button,
            (activeValue.length !== 6 || saving) &&
              styles.buttonDisabled,
          ]}
          onPress={
            step === 'create'
              ? handleCreatePin
              : handleConfirmPin
          }
        >
          <Text style={styles.buttonText}>
            {saving
              ? 'Saving...'
              : step === 'create'
                ? 'Continue'
                : 'Confirm PIN'}
          </Text>
        </Pressable>

        {step === 'confirm' && !saving && (
          <Pressable onPress={resetPin}>
            <Text style={styles.changePinText}>
              Choose a different PIN
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
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
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
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

  changePinText: {
    textAlign: 'center',
    marginTop: 22,
    fontSize: 15,
    fontWeight: '600',
    color: '#4169E1',
  },
});