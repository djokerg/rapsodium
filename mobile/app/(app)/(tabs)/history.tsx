import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
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
import { useHistory } from '@/hooks/useHistory';
import { useToggleSave } from '@/hooks/useToggleSave';
import { formatRelativeTime } from '@/lib/relativeTime';
import { usePlayerStore } from '@/stores/player.store';
import type { SongWithTimestamp } from '@/types/songs';

export default function History() {
  const router = useRouter();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    error,
  } = useHistory();
  const { data: favoriteIds } = useFavoriteIds();
  const toggleSave = useToggleSave();

  const songs: SongWithTimestamp[] = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const renderItem = useCallback(
    ({ item }: { item: SongWithTimestamp }) => {
      const isSaved = favoriteIds?.has(item.id) ?? false;
      return (
        <SongRow
          song={item}
          isSaved={isSaved}
          onToggleSave={() => toggleSave.mutate({ songId: item.id, isSaved })}
          onPress={() => {
            setQueue(songs.map((s) => s.id));
            router.push(`/song/${item.id}`);
          }}
          meta={`Played ${formatRelativeTime(item.interactedAt)}`}
        />
      );
    },
    [favoriteIds, toggleSave, setQueue, songs, router],
  );

  const onEndReached = useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#164e63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-4 pb-3 pt-2">
          <Text className="text-2xl font-bold text-white">Recently played</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#67e8f9" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-rose-200">
              Couldn&apos;t load your history.
            </Text>
            <Pressable
              onPress={() => void refetch()}
              className="mt-4 rounded-full bg-white/10 px-4 py-2 active:bg-white/20"
            >
              <Text className="text-white">Try again</Text>
            </Pressable>
          </View>
        ) : songs.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="time-outline" size={40} color="#67e8f966" />
            <Text className="mt-4 text-center text-base text-brand-100/70">
              Songs you play will appear here.
            </Text>
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
          />
        )}
      </SafeAreaView>
    </View>
  );
}
