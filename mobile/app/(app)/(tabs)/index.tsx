import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlgorithmPicker,
  type AlgorithmOption,
} from '@/components/AlgorithmPicker';
import { SongRow } from '@/components/SongRow';
import { useFavoriteIds } from '@/hooks/useFavoriteIds';
import { useRecommendations, type Algorithm } from '@/hooks/useRecommendations';
import { useToggleSave } from '@/hooks/useToggleSave';
import { useAuthStore } from '@/stores/auth.store';
import { usePlayerStore } from '@/stores/player.store';
import type { SongSummary } from '@/types/songs';

const OPTIONS: readonly AlgorithmOption<Algorithm>[] = [
  { value: 'popularity', label: 'Popular' },
  { value: 'content', label: 'You might like' },
  { value: 'collaborative', label: 'Your crowd loves' },
];

const TAGLINES: Record<Algorithm, string> = {
  popularity: 'Global favorites, filtered to your picked genres.',
  content: 'Picked by the feel of songs you\u2019ve saved.',
  collaborative: 'From listeners with a taste like yours.',
};

const EMPTY_COPY: Record<Algorithm, string> = {
  popularity: 'No recommendations yet. Try saving or playing a few songs.',
  content: 'Save a few songs you love — we need them to pick similar tracks.',
  collaborative:
    'Play and save a few songs so we can match you with other listeners.',
};

export default function Home() {
  const router = useRouter();
  const clearToken = useAuthStore((s) => s.clearToken);
  const setQueue = usePlayerStore((s) => s.setQueue);

  const [algorithm, setAlgorithm] = useState<Algorithm>('popularity');

  const handleLogout = async (): Promise<void> => {
    await clearToken();
    router.replace('/');
  };

  const { data, isLoading, isRefetching, refetch, error } =
    useRecommendations(algorithm);
  const { data: favoriteIds } = useFavoriteIds();
  const toggleSave = useToggleSave();

  const songs: SongSummary[] = useMemo(() => data?.data ?? [], [data]);

  const renderItem = useCallback(
    ({ item }: { item: SongSummary }) => {
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
        />
      );
    },
    [favoriteIds, toggleSave, setQueue, router, songs],
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#67e8f9" />
        </View>
      );
    }

    if (error) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-rose-200">
            Couldn&apos;t load recommendations.
          </Text>
          <Text className="mt-2 text-center text-sm text-brand-100/60">
            Make sure the recommender service is running.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="mt-4 rounded-full bg-white/10 px-4 py-2 active:bg-white/20"
          >
            <Text className="text-white">Try again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#67e8f9"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-24">
            <Text className="text-center text-base text-brand-100/70">
              {EMPTY_COPY[algorithm]}
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
          <Text className="text-2xl font-bold text-white">For you</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={() => router.push('/(app)/search')}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <Ionicons name="search" size={20} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/preferences')}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <Ionicons name="options-outline" size={20} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={handleLogout}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <Ionicons name="log-out-outline" size={20} color="#fda4af" />
            </Pressable>
          </View>
        </View>

        <Text numberOfLines={1} className="px-4 pb-2 text-xs text-brand-100/60">
          {TAGLINES[algorithm]}
        </Text>

        <AlgorithmPicker
          options={OPTIONS}
          value={algorithm}
          onChange={setAlgorithm}
        />

        {renderBody()}
      </SafeAreaView>
    </View>
  );
}
