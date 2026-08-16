import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-profile" />
        <Stack.Screen name="create-pin" />
        <Stack.Screen name="biometrics" />
        <Stack.Screen name="unlock" />
        <Stack.Screen name="chats" />
      </Stack>

      <StatusBar style="dark" />
    </>
  );
}