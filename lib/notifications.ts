import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log(
        'Push notifications require a physical device.'
      );
      return null;
    }

    const {
      status: existingStatus,
    } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (
      existingStatus !== 'granted'
    ) {
      const {
        status,
      } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (
      finalStatus !== 'granted'
    ) {
      console.log(
        'Notification permission not granted.'
      );
      return null;
    }

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.log(
        'No EAS projectId found.'
      );
      return null;
    }

    const tokenResponse =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const expoPushToken =
      tokenResponse.data;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      console.log(
        'No signed-in user for push registration.'
      );
      return null;
    }

    const deviceName =
      Device.deviceName ??
      Device.modelName ??
      null;

    const platform =
      Platform.OS;

    const {
      error: upsertError,
    } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_push_token:
            expoPushToken,
          device_name:
            deviceName,
          platform,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'user_id,expo_push_token',
        }
      );

    if (upsertError) {
      console.error(
        'Push token save error:',
        upsertError
      );
      return null;
    }

    return expoPushToken;
  } catch (error) {
    console.error(
      'Push registration error:',
      error
    );

    return null;
  }
}