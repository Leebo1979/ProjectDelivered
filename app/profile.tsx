import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const [
    userId,
    setUserId,
  ] = useState<string | null>(
    null
  );

  const [
    displayName,
    setDisplayName,
  ] = useState('');

  const [
    username,
    setUsername,
  ] = useState('');

  const [
    avatarPath,
    setAvatarPath,
  ] = useState<string | null>(
    null
  );

  const [
    avatarUrl,
    setAvatarUrl,
  ] = useState<string | null>(
    null
  );

  const [
    pendingPhotoUri,
    setPendingPhotoUri,
  ] = useState<string | null>(
    null
  );

  const [
    pendingMimeType,
    setPendingMimeType,
  ] = useState('image/jpeg');

  const [
    pendingExtension,
    setPendingExtension,
  ] = useState('jpg');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    messageNotifications,
    setMessageNotifications,
  ] = useState(true);

  const [
    groupNotifications,
    setGroupNotifications,
  ] = useState(true);

  const [
    notificationSound,
    setNotificationSound,
  ] = useState(true);

  const cleanUsername =
    username
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9._]/g,
        ''
      );

  const loadProfile =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const {
            data: { user },
            error:
              userError,
          } =
            await supabase.auth.getUser();

          if (
            userError ||
            !user
          ) {
            Alert.alert(
              'Not signed in',
              'Please sign in again.'
            );

            router.replace(
              '/sign-up'
            );
            return;
          }

          setUserId(
            user.id
          );

          const {
            data:
              profile,
            error,
          } =
            await supabase
              .from(
                'profiles'
              )
              .select(
                'display_name, username, avatar_path, message_notifications, group_notifications, notification_sound'
              )
              .eq(
                'id',
                user.id
              )
              .maybeSingle();

          if (error) {
            Alert.alert(
              'Unable to load profile',
              error.message
            );
            return;
          }

          setDisplayName(
            profile
              ?.display_name ??
              ''
          );

          setUsername(
            profile
              ?.username ??
              ''
          );

          setAvatarPath(
            profile
              ?.avatar_path ??
              null
          );

          setMessageNotifications(
            profile
              ?.message_notifications ??
              true
          );

          setGroupNotifications(
            profile
              ?.group_notifications ??
              true
          );

          setNotificationSound(
            profile
              ?.notification_sound ??
              true
          );

          setPendingPhotoUri(
            null
          );

          if (
            profile
              ?.avatar_path
          ) {
            const {
              data:
                signedData,
              error:
                signedError,
            } =
              await supabase
                .storage
                .from(
                  'message-attachments'
                )
                .createSignedUrl(
                  profile.avatar_path,
                  60 * 60
                );

            if (
              !signedError &&
              signedData
            ) {
              setAvatarUrl(
                signedData.signedUrl
              );
            } else {
              setAvatarUrl(
                null
              );
            }
          } else {
            setAvatarUrl(
              null
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        loadProfile();
      },
      [loadProfile]
    )
  );

  const choosePhoto =
    async () => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        permission.status !==
        'granted'
      ) {
        Alert.alert(
          'Photo access required',
          'Please allow photo library access to choose a profile photo.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing:
            true,
          aspect: [1, 1],
          quality: 0.9,
        });

      if (
        result.canceled
      ) {
        return;
      }

      const asset =
        result.assets[0];

      setPendingPhotoUri(
        asset.uri
      );

      setPendingMimeType(
        asset.mimeType ??
          'image/jpeg'
      );

      setPendingExtension(
        asset.fileName
          ?.split('.')
          .pop()
          ?.toLowerCase() ??
          'jpg'
      );
    };

  const saveProfile =
    async () => {
      const cleanName =
        displayName.trim();

      if (!cleanName) {
        Alert.alert(
          'Display name required',
          'Please enter your display name.'
        );
        return;
      }

      if (
        cleanUsername.length <
        3
      ) {
        Alert.alert(
          'Username too short',
          'Please choose a username with at least 3 characters.'
        );
        return;
      }

      if (!userId) {
        return;
      }

      let newAvatarPath =
        avatarPath;

      let uploadedPath:
        string | null =
        null;

      try {
        setSaving(true);

        if (
          pendingPhotoUri
        ) {
          const path =
            `profile-avatars/${userId}/${Date.now()}.${pendingExtension}`;

          const response =
            await fetch(
              pendingPhotoUri
            );

          const buffer =
            await response.arrayBuffer();

          const {
            error:
              uploadError,
          } =
            await supabase
              .storage
              .from(
                'message-attachments'
              )
              .upload(
                path,
                buffer,
                {
                  contentType:
                    pendingMimeType,
                  upsert:
                    false,
                }
              );

          if (
            uploadError
          ) {
            throw uploadError;
          }

          uploadedPath =
            path;

          newAvatarPath =
            path;
        }

        const {
          error,
        } =
          await supabase
            .from(
              'profiles'
            )
            .update({
              display_name:
                cleanName,
              username:
                cleanUsername,
              avatar_path:
                newAvatarPath,
              message_notifications:
                messageNotifications,
              group_notifications:
                groupNotifications,
              notification_sound:
                notificationSound,
              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              userId
            );

        if (error) {
          throw error;
        }

        if (
          uploadedPath &&
          avatarPath &&
          avatarPath !==
            uploadedPath
        ) {
          await supabase
            .storage
            .from(
              'message-attachments'
            )
            .remove([
              avatarPath,
            ]);
        }

        Alert.alert(
          'Profile updated',
          'Your changes have been saved.'
        );

        await loadProfile();
      } catch (
        error: any
      ) {
        if (
          uploadedPath
        ) {
          await supabase
            .storage
            .from(
              'message-attachments'
            )
            .remove([
              uploadedPath,
            ]);
        }

        const message =
          error?.message ??
          'Please try again.';

        if (
          message
            .toLowerCase()
            .includes(
              'username'
            )
        ) {
          Alert.alert(
            'Username unavailable',
            'That username is already being used by another account.'
          );
        } else {
          Alert.alert(
            'Unable to update profile',
            message
          );
        }
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <ActivityIndicator
          size="large"
          color="#4169E1"
          style={
            styles.loader
          }
        />
      </SafeAreaView>
    );
  }

  const displayedAvatar =
    pendingPhotoUri ??
    avatarUrl;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.container
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.back
              }
            >
              ‹ Back
            </Text>
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Profile
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <View
          style={
            styles.avatarSection
          }
        >
          <Pressable
            style={
              styles.avatar
            }
            onPress={
              choosePhoto
            }
            disabled={
              saving
            }
          >
            {displayedAvatar ? (
              <Image
                source={{
                  uri:
                    displayedAvatar,
                }}
                style={
                  styles.avatarImage
                }
              />
            ) : (
              <Text
                style={
                  styles.avatarText
                }
              >
                {displayName
                  .charAt(0)
                  .toUpperCase() ||
                  '?'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={
              choosePhoto
            }
            disabled={
              saving
            }
          >
            <Text
              style={
                styles.changePhoto
              }
            >
              {displayedAvatar
                ? 'Change photo'
                : 'Add photo'}
            </Text>
          </Pressable>
        </View>

        <View
          style={
            styles.field
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Display Name
          </Text>

          <TextInput
            value={
              displayName
            }
            onChangeText={
              setDisplayName
            }
            style={
              styles.input
            }
            autoCapitalize="words"
          />
        </View>

        <View
          style={
            styles.field
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Username
          </Text>

          <View
            style={
              styles.usernameRow
            }
          >
            <Text
              style={
                styles.at
              }
            >
              @
            </Text>

            <TextInput
              value={
                username
              }
              onChangeText={(
                value
              ) =>
                setUsername(
                  value
                    .toLowerCase()
                    .replace(
                      /[^a-z0-9._]/g,
                      ''
                    )
                )
              }
              style={
                styles.usernameInput
              }
              autoCapitalize="none"
              autoCorrect={
                false
              }
            />
          </View>
        </View>

        <View
          style={
            styles.settingsSection
          }
        >
          <Text
            style={
              styles.settingsTitle
            }
          >
            Notifications
          </Text>

          <View
            style={
              styles.settingRow
            }
          >
            <View
              style={
                styles.settingText
              }
            >
              <Text
                style={
                  styles.settingLabel
                }
              >
                Message notifications
              </Text>

              <Text
                style={
                  styles.settingDescription
                }
              >
                Notifications for direct messages
              </Text>
            </View>

            <Switch
              value={
                messageNotifications
              }
              onValueChange={
                setMessageNotifications
              }
              disabled={
                saving
              }
            />
          </View>

          <View
            style={
              styles.settingRow
            }
          >
            <View
              style={
                styles.settingText
              }
            >
              <Text
                style={
                  styles.settingLabel
                }
              >
                Group notifications
              </Text>

              <Text
                style={
                  styles.settingDescription
                }
              >
                Notifications for group conversations
              </Text>
            </View>

            <Switch
              value={
                groupNotifications
              }
              onValueChange={
                setGroupNotifications
              }
              disabled={
                saving
              }
            />
          </View>

          <View
            style={[
              styles.settingRow,
              styles.settingRowLast,
            ]}
          >
            <View
              style={
                styles.settingText
              }
            >
              <Text
                style={
                  styles.settingLabel
                }
              >
                Notification sound
              </Text>

              <Text
                style={
                  styles.settingDescription
                }
              >
                Play a sound for notifications
              </Text>
            </View>

            <Switch
              value={
                notificationSound
              }
              onValueChange={
                setNotificationSound
              }
              disabled={
                saving
              }
            />
          </View>
        </View>

        <Pressable
          style={[
            styles.saveButton,
            saving &&
              styles.disabled,
          ]}
          disabled={
            saving
          }
          onPress={
            saveProfile
          }
        >
          <Text
            style={
              styles.saveButtonText
            }
          >
            {saving
              ? 'Saving...'
              : 'Save Changes'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#F7F8FA',
    },

    container: {
      flex: 1,
      paddingHorizontal:
        24,
      paddingTop: 18,
    },

    loader: {
      marginTop: 80,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 34,
    },

    back: {
      width: 70,
      fontSize: 16,
      fontWeight: '600',
      color:
        '#4169E1',
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color:
        '#101828',
    },

    headerSpacer: {
      width: 70,
    },

    avatarSection: {
      alignItems:
        'center',
      marginBottom: 34,
    },

    avatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor:
        '#E8ECFB',
      alignItems:
        'center',
      justifyContent:
        'center',
      overflow: 'hidden',
      marginBottom: 12,
    },

    avatarImage: {
      width: '100%',
      height: '100%',
    },

    avatarText: {
      fontSize: 38,
      fontWeight: '800',
      color:
        '#4169E1',
    },

    changePhoto: {
      fontSize: 15,
      fontWeight: '700',
      color:
        '#4169E1',
    },

    field: {
      marginBottom: 22,
    },

    label: {
      fontSize: 14,
      fontWeight: '700',
      color:
        '#344054',
      marginBottom: 8,
    },

    input: {
      height: 52,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      borderRadius: 12,
      paddingHorizontal:
        16,
      backgroundColor:
        '#FFFFFF',
      fontSize: 17,
      color:
        '#101828',
    },

    usernameRow: {
      height: 52,
      borderWidth: 1,
      borderColor:
        '#D0D5DD',
      borderRadius: 12,
      paddingHorizontal:
        16,
      backgroundColor:
        '#FFFFFF',
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    at: {
      fontSize: 17,
      color:
        '#667085',
      marginRight: 3,
    },

    usernameInput: {
      flex: 1,
      fontSize: 17,
      color:
        '#101828',
    },

    settingsSection: {
      marginTop: 6,
      marginBottom: 24,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#EAECF0',
      borderRadius: 14,
      overflow: 'hidden',
    },

    settingsTitle: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.7,
      color:
        '#667085',
      textTransform:
        'uppercase',
    },

    settingRow: {
      minHeight: 68,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    settingRowLast: {
      borderBottomWidth: 0,
    },

    settingText: {
      flex: 1,
      paddingRight: 12,
    },

    settingLabel: {
      fontSize: 15,
      fontWeight: '700',
      color:
        '#101828',
    },

    settingDescription: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 17,
      color:
        '#667085',
    },

    saveButton: {
      marginTop: 10,
      height: 54,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#4169E1',
    },

    disabled: {
      opacity: 0.5,
    },

    saveButtonText: {
      fontSize: 17,
      fontWeight: '800',
      color:
        '#FFFFFF',
    },
  });