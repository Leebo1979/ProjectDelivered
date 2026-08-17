import {
    router,
    useLocalSearchParams,
} from 'expo-router';
import {
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type MediaMessage = {
  id: string;
  created_at: string;
  attachment_path: string;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
};

type UrlMap = Record<string, string>;

export default function MediaFilesScreen() {
  const {
    conversationId,
    title,
  } =
    useLocalSearchParams<{
      conversationId: string;
      title?: string;
    }>();

  const [
    items,
    setItems,
  ] = useState<
    MediaMessage[]
  >([]);

  const [
    urlMap,
    setUrlMap,
  ] = useState<UrlMap>(
    {}
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    loadMediaAndFiles();
  }, [conversationId]);

  const loadMediaAndFiles =
    async () => {
      if (!conversationId) {
        return;
      }

      try {
        setLoading(true);

        const {
          data,
          error,
        } = await supabase
          .from('messages')
          .select(
            `
            id,
            created_at,
            attachment_path,
            attachment_name,
            attachment_type,
            attachment_size
            `
          )
          .eq(
            'conversation_id',
            conversationId
          )
          .not(
            'attachment_path',
            'is',
            null
          )
          .is(
            'deleted_at',
            null
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );

        if (error) {
          Alert.alert(
            'Unable to load media',
            error.message
          );
          return;
        }

        const loaded =
          (
            data ??
            []
          ).filter(
            (item) =>
              !!item.attachment_path
          ) as MediaMessage[];

        setItems(
          loaded
        );

        const nextUrls:
          UrlMap = {};

        await Promise.all(
          loaded.map(
            async (
              item
            ) => {
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
                    item.attachment_path,
                    60 * 60
                  );

              if (
                !signedError &&
                signedData
              ) {
                nextUrls[
                  item.id
                ] =
                  signedData.signedUrl;
              }
            }
          )
        );

        setUrlMap(
          nextUrls
        );
      } catch (error) {
        console.error(
          'Media/files load error:',
          error
        );

        Alert.alert(
          'Unable to load media',
          'Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  const photos =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.attachment_type?.startsWith(
              'image/'
            )
        ),
      [items]
    );

  const videos =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.attachment_type?.startsWith(
              'video/'
            )
        ),
      [items]
    );

  const files =
    useMemo(
      () =>
        items.filter(
          (item) =>
            !item.attachment_type?.startsWith(
              'image/'
            ) &&
            !item.attachment_type?.startsWith(
              'video/'
            ) &&
            !item.attachment_type?.startsWith(
              'audio/'
            )
        ),
      [items]
    );

  const openUrl =
    async (
      item: MediaMessage
    ) => {
      const url =
        urlMap[
          item.id
        ];

      if (!url) {
        Alert.alert(
          'Attachment unavailable',
          'Please try again in a moment.'
        );
        return;
      }

      const canOpen =
        await Linking.canOpenURL(
          url
        );

      if (canOpen) {
        await Linking.openURL(
          url
        );
      } else {
        Alert.alert(
          'Unable to open attachment',
          'This attachment cannot be opened on this device.'
        );
      }
    };

  const shareItem =
    async (
      item: MediaMessage
    ) => {
      const url =
        urlMap[
          item.id
        ];

      if (!url) {
        return;
      }

      await Share.share({
        title:
          item.attachment_name ??
          'Attachment',
        message:
          url,
        url,
      });
    };

  const formatFileSize =
    (
      bytes:
        number | null
    ) => {
      if (!bytes) {
        return '';
      }

      if (bytes < 1024) {
        return `${bytes} B`;
      }

      if (
        bytes <
        1024 * 1024
      ) {
        return `${(
          bytes / 1024
        ).toFixed(1)} KB`;
      }

      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    };

  const getType =
    (
      item: MediaMessage
    ) => {
      const type =
        item.attachment_type ??
        '';

      const name =
        item.attachment_name
          ?.toLowerCase() ??
        '';

      if (
        type ===
          'application/pdf' ||
        name.endsWith(
          '.pdf'
        )
      ) {
        return 'PDF';
      }

      if (
        type.includes(
          'word'
        ) ||
        name.endsWith(
          '.doc'
        ) ||
        name.endsWith(
          '.docx'
        )
      ) {
        return 'WORD';
      }

      if (
        type.includes(
          'spreadsheet'
        ) ||
        type.includes(
          'excel'
        ) ||
        name.endsWith(
          '.xls'
        ) ||
        name.endsWith(
          '.xlsx'
        )
      ) {
        return 'SHEET';
      }

      if (
        type.includes(
          'presentation'
        ) ||
        type.includes(
          'powerpoint'
        ) ||
        name.endsWith(
          '.ppt'
        ) ||
        name.endsWith(
          '.pptx'
        )
      ) {
        return 'SLIDES';
      }

      return 'FILE';
    };

  const empty =
    photos.length === 0 &&
    videos.length === 0 &&
    files.length === 0;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.title
            }
            numberOfLines={
              1
            }
          >
            Media & Files
          </Text>

          <Text
            style={
              styles.subtitle
            }
            numberOfLines={
              1
            }
          >
            {title ??
              'Conversation'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View
          style={
            styles.loader
          }
        >
          <ActivityIndicator
            size="large"
            color="#4169E1"
          />
        </View>
      ) : empty ? (
        <View
          style={
            styles.emptyState
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            No shared media yet
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Photos, videos and documents shared in this conversation will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
        >
          {photos.length >
            0 && (
            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                PHOTOS
              </Text>

              <View
                style={
                  styles.photoGrid
                }
              >
                {photos.map(
                  (item) => (
                    <Pressable
                      key={
                        item.id
                      }
                      style={
                        styles.photoCell
                      }
                      onPress={() =>
                        openUrl(
                          item
                        )
                      }
                      onLongPress={() =>
                        shareItem(
                          item
                        )
                      }
                      delayLongPress={
                        350
                      }
                    >
                      {urlMap[
                        item.id
                      ] ? (
                        <Image
                          source={{
                            uri:
                              urlMap[
                                item.id
                              ],
                          }}
                          style={
                            styles.photo
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={
                            styles.photoPlaceholder
                          }
                        />
                      )}
                    </Pressable>
                  )
                )}
              </View>
            </View>
          )}

          {videos.length >
            0 && (
            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                VIDEOS
              </Text>

              {videos.map(
                (item) => (
                  <Pressable
                    key={
                      item.id
                    }
                    style={
                      styles.videoRow
                    }
                    onPress={() =>
                      openUrl(
                        item
                      )
                    }
                    onLongPress={() =>
                      shareItem(
                        item
                      )
                    }
                    delayLongPress={
                      350
                    }
                  >
                    <View
                      style={
                        styles.videoBadge
                      }
                    >
                      <Text
                        style={
                          styles.videoBadgeText
                        }
                      >
                        VIDEO
                      </Text>
                    </View>

                    <View
                      style={
                        styles.rowInfo
                      }
                    >
                      <Text
                        style={
                          styles.fileName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {item.attachment_name ??
                          'Video'}
                      </Text>

                      <Text
                        style={
                          styles.meta
                        }
                      >
                        {formatFileSize(
                          item.attachment_size
                        ) ||
                          'Tap to open'}
                      </Text>
                    </View>
                  </Pressable>
                )
              )}
            </View>
          )}

          {files.length >
            0 && (
            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                FILES
              </Text>

              {files.map(
                (item) => (
                  <Pressable
                    key={
                      item.id
                    }
                    style={
                      styles.fileRow
                    }
                    onPress={() =>
                      openUrl(
                        item
                      )
                    }
                    onLongPress={() =>
                      shareItem(
                        item
                      )
                    }
                    delayLongPress={
                      350
                    }
                  >
                    <View
                      style={
                        styles.fileBadge
                      }
                    >
                      <Text
                        style={
                          styles.fileBadgeText
                        }
                      >
                        {getType(
                          item
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.rowInfo
                      }
                    >
                      <Text
                        style={
                          styles.fileName
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {item.attachment_name ??
                          'Attachment'}
                      </Text>

                      <Text
                        style={
                          styles.meta
                        }
                      >
                        {[
                          getType(
                            item
                          ),
                          formatFileSize(
                            item.attachment_size
                          ),
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ' · '
                          )}
                      </Text>
                    </View>
                  </Pressable>
                )
              )}
            </View>
          )}

          <Text
            style={
              styles.helpText
            }
          >
            Tap to open. Long-press to share.
          </Text>
        </ScrollView>
      )}
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

    header: {
      height: 78,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    backButton: {
      width: 36,
      marginRight: 6,
    },

    backText: {
      fontSize: 38,
      lineHeight: 40,
      color:
        '#4169E1',
    },

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 24,
      fontWeight: '800',
      color:
        '#101828',
    },

    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color:
        '#667085',
    },

    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyState: {
      flex: 1,
      paddingHorizontal: 30,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      fontSize: 19,
      fontWeight: '800',
      color:
        '#101828',
      marginBottom: 8,
    },

    emptyText: {
      maxWidth: 310,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      color:
        '#667085',
    },

    content: {
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 40,
    },

    section: {
      marginBottom: 28,
    },

    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.4,
      color:
        '#98A2B3',
      marginBottom: 12,
    },

    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -3,
    },

    photoCell: {
      width: '33.333%',
      aspectRatio: 1,
      padding: 3,
    },

    photo: {
      width: '100%',
      height: '100%',
      borderRadius: 10,
      backgroundColor:
        '#EAECF0',
    },

    photoPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 10,
      backgroundColor:
        '#EAECF0',
    },

    videoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    videoBadge: {
      width: 58,
      height: 48,
      borderRadius: 10,
      backgroundColor:
        '#101828',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    videoBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      color:
        '#FFFFFF',
    },

    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EAECF0',
    },

    fileBadge: {
      width: 58,
      height: 48,
      borderRadius: 10,
      backgroundColor:
        '#EEF2FF',
      borderWidth: 1,
      borderColor:
        '#D9E0FF',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    fileBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      color:
        '#4169E1',
    },

    rowInfo: {
      flex: 1,
    },

    fileName: {
      fontSize: 15,
      fontWeight: '700',
      color:
        '#101828',
    },

    meta: {
      marginTop: 4,
      fontSize: 12,
      color:
        '#667085',
    },

    helpText: {
      marginTop: 4,
      textAlign: 'center',
      fontSize: 12,
      color:
        '#98A2B3',
    },
  });