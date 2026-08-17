import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type FavouriteItem = {
  message_id: string;
  created_at: string;
  messages: {
    id: string;
    body: string;
    conversation_id: string;
    created_at: string;
  } | null;
};

export default function FavouritesScreen() {
  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavourites();
  }, []);

  const loadFavourites = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('favourite_messages')
        .select(`
          message_id,
          created_at,
          messages (
            id,
            body,
            conversation_id,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Favourite load error:', error);
        return;
      }

      setItems((data ?? []) as FavouriteItem[]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.title}>Favourites</Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#4169E1"
            style={styles.loader}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.message_id}
            contentContainerStyle={
              items.length === 0
                ? styles.emptyList
                : styles.list
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No favourite messages yet.
              </Text>
            }
            renderItem={({ item }) => {
              if (!item.messages) {
                return null;
              }

              return (
                <Pressable
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: '/conversation',
                      params: {
                        conversationId:
                          item.messages!.conversation_id,
                      },
                    })
                  }
                >
                  <Text style={styles.star}>★</Text>

                  <View style={styles.cardContent}>
                    <Text
                      style={styles.messageText}
                      numberOfLines={3}
                    >
                      {item.messages.body}
                    </Text>

                    <Text style={styles.date}>
                      {new Date(
                        item.messages.created_at
                      ).toLocaleString()}
                    </Text>
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            }}
          />
        )}
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
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  backButton: {
    width: 36,
    marginRight: 6,
  },

  backText: {
    fontSize: 38,
    lineHeight: 40,
    color: '#4169E1',
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#101828',
  },

  loader: {
    marginTop: 40,
  },

  list: {
    paddingBottom: 30,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    color: '#98A2B3',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },

  star: {
    fontSize: 20,
    marginRight: 12,
    color: '#F79009',
  },

  cardContent: {
    flex: 1,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#101828',
  },

  date: {
    marginTop: 5,
    fontSize: 12,
    color: '#98A2B3',
  },

  chevron: {
    fontSize: 26,
    color: '#98A2B3',
    marginLeft: 12,
  },
});