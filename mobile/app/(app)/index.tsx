import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SongRow } from '@/components/SongRow';
import { useFavoriteIds } from '@/hooks/useFavoriteIds';
import { useSongs } from '@/hooks/useSongs';
import { useToggleSave } from '@/hooks/useToggleSave';
import type { SongSummary } from '@/types/songs';

export default function Home() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    error,
  } = useSongs();
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

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
          <Text className="text-2xl font-bold text-white">For you</Text>
          <Pressable
            onPress={() => router.push('/(app)/preferences')}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Ionicons name="options-outline" size={20} color="#ffffff" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#67e8f9" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-rose-200">
              Couldn&apos;t load songs.
            </Text>
            <Pressable
              onPress={() => void refetch()}
              className="mt-4 rounded-full bg-white/10 px-4 py-2 active:bg-white/20"
            >
              <Text className="text-white">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching && !isFetchingNextPage}
                onRefresh={() => void refetch()}
                tintColor="#67e8f9"
              />
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-6">
                  <ActivityIndicator color="#67e8f9" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-8 pt-24">
                <Text className="text-center text-base text-brand-100/70">
                  No songs yet.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
