import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavoriteIds } from '@/hooks/useFavoriteIds';
import { useRecordPlay } from '@/hooks/useRecordPlay';
import { useSong } from '@/hooks/useSong';
import { useToggleSave } from '@/hooks/useToggleSave';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: song, isLoading, error } = useSong(id);
  const { data: favoriteIds } = useFavoriteIds();
  const toggleSave = useToggleSave();
  const recordPlay = useRecordPlay();

  const source = useMemo(
    () => (song?.previewUrl ? { uri: song.previewUrl } : null),
    [song?.previewUrl],
  );
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const isSaved = favoriteIds?.has(id) ?? false;
  const positionSec = status.currentTime ?? 0;
  const durationSec = status.duration || song?.durationSec || 0;
  const progress = durationSec > 0 ? positionSec / durationSec : 0;

  const maxListenedRef = useRef(0);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (positionSec > maxListenedRef.current) {
      maxListenedRef.current = positionSec;
    }
  }, [positionSec]);

  const reportPlayOnce = (): void => {
    if (reportedRef.current) return;
    if (!id || maxListenedRef.current <= 0) return;
    reportedRef.current = true;
    recordPlay.mutate({ songId: id, listenedSeconds: maxListenedRef.current });
  };

  useEffect(() => {
    if (status.didJustFinish) {
      reportPlayOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  useEffect(() => {
    return () => {
      reportPlayOnce();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlayback = (): void => {
    if (!source) return;
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <ActivityIndicator color="#67e8f9" />
      </View>
    );
  }

  if (error || !song) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-8">
        <Text className="text-center text-base text-rose-200">
          Couldn&apos;t load this song.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-full bg-white/10 px-5 py-2 active:bg-white/20"
        >
          <Text className="text-white">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0c4a6e', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </Pressable>
          <Pressable
            onPress={() => toggleSave.mutate({ songId: song.id, isSaved })}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={20}
              color={isSaved ? '#22d3ee' : '#ffffff'}
            />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-ink-800 shadow-2xl">
            {song.coverUrl ? (
              <Image
                source={{ uri: song.coverUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="musical-notes" size={64} color="#67e8f966" />
              </View>
            )}
          </View>

          <View className="mt-8 w-full items-center">
            <Text
              numberOfLines={2}
              className="text-center text-3xl font-bold text-white tracking-tight"
            >
              {song.title}
            </Text>
            <Text
              numberOfLines={1}
              className="mt-2 text-center text-lg text-brand-100/80"
            >
              {song.artist}
            </Text>
            {song.album ? (
              <Text
                numberOfLines={1}
                className="mt-1 text-sm text-brand-100/60"
              >
                {song.album}
              </Text>
            ) : null}
            <View className="mt-3 flex-row" style={{ gap: 8 }}>
              <View className="rounded-full bg-white/10 px-3 py-1">
                <Text className="text-xs font-medium capitalize text-brand-100/80">
                  {song.genre}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-8 pb-6">
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <View
              className="h-full bg-brand-300"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-xs text-brand-100/60">
              {formatTime(positionSec)}
            </Text>
            <Text className="text-xs text-brand-100/60">
              {formatTime(durationSec)}
            </Text>
          </View>

          <View className="mt-6 items-center">
            <Pressable
              onPress={togglePlayback}
              disabled={!source}
              className={`h-20 w-20 items-center justify-center rounded-full ${
                source
                  ? 'bg-brand-400 active:bg-brand-500'
                  : 'bg-white/10'
              }`}
            >
              <Ionicons
                name={status.playing ? 'pause' : 'play'}
                size={34}
                color={source ? '#020617' : '#cffafe66'}
                style={{ marginLeft: status.playing ? 0 : 3 }}
              />
            </Pressable>
            {!source ? (
              <Text className="mt-3 text-center text-xs text-brand-100/60">
                No preview available
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
