import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SongRow } from '@/components/SongRow';
import { useFavoriteIds } from '@/hooks/useFavoriteIds';
import { useSearchSongs } from '@/hooks/useSearchSongs';
import { useToggleSave } from '@/hooks/useToggleSave';
import type { SongSummary } from '@/types/songs';

const DEBOUNCE_MS = 300;

export default function Search() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input]);

  const {
    data,
    isFetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
  } = useSearchSongs(debounced);
  const { data: favoriteIds } = useFavoriteIds();
  const toggleSave = useToggleSave();

  const songs: SongSummary[] =
    data?.pages.flatMap((page) => page.data) ?? [];

  const renderItem = useCallback(
    ({ item }: { item: SongSummary }) => {
      const isSaved = favoriteIds?.has(item.id) ?? false;
      return (
        <SongRow
          song={item}
          isSaved={isSaved}
          onToggleSave={() => toggleSave.mutate({ songId: item.id, isSaved })}
        />
      );
    },
    [favoriteIds, toggleSave],
  );

  const onEndReached = useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const trimmed = debounced.trim();
  const hasQuery = trimmed.length > 0;
  const showLoading = hasQuery && isLoading;
  const showEmpty = hasQuery && !isFetching && songs.length === 0;

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3">
            <Ionicons name="search" size={18} color="#cffafe99" />
            <TextInput
              value={input}
              onChangeText={setInput}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Search songs, artists, genres"
              placeholderTextColor="#67e8f970"
              returnKeyType="search"
              className="flex-1 py-3 text-base text-white"
            />
            {input.length > 0 ? (
              <Pressable onPress={() => setInput('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#cffafe99" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {!hasQuery ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="musical-notes-outline" size={40} color="#67e8f966" />
            <Text className="mt-4 text-center text-base text-brand-100/70">
              Start typing to find songs, artists, or genres.
            </Text>
          </View>
        ) : showLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#67e8f9" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-rose-200">
              Search failed. Try again.
            </Text>
          </View>
        ) : showEmpty ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-brand-100/70">
              No results for &ldquo;{trimmed}&rdquo;.
            </Text>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-6">
                  <ActivityIndicator color="#67e8f9" />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
