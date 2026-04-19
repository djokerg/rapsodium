import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SongSummary } from '@/types/songs';

interface SongRowProps {
  song: SongSummary;
  isSaved: boolean;
  onToggleSave: () => void;
  onPress?: () => void;
  meta?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SongRowInner({ song, isSaved, onToggleSave, onPress, meta }: SongRowProps) {
  const router = useRouter();

  const handlePress = (): void => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/song/${song.id}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-3 border-b border-white/5 px-4 py-3 active:bg-white/5"
    >
      <View className="h-14 w-14 overflow-hidden rounded-lg bg-ink-800">
        {song.coverUrl ? (
          <Image
            source={{ uri: song.coverUrl }}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            transition={200}
          />
        ) : null}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-white">
          {song.title}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-sm text-brand-100/60">
          {song.artist} · {formatDuration(song.durationSec)}
        </Text>
        {meta ? (
          <Text numberOfLines={1} className="mt-0.5 text-xs text-brand-100/40">
            {meta}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onToggleSave}
        hitSlop={10}
        className="h-10 w-10 items-center justify-center"
      >
        <Ionicons
          name={isSaved ? 'heart' : 'heart-outline'}
          size={22}
          color={isSaved ? '#22d3ee' : '#cffafe99'}
        />
      </Pressable>
    </Pressable>
  );
}

export const SongRow = memo(SongRowInner);
