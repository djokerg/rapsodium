import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export const GENRES = [
  'pop',
  'rock',
  'hip hop',
  'r&b',
  'electronic',
  'jazz',
  'classical',
  'latin',
  'metal',
  'country',
] as const;

interface GenreGridProps {
  selected: Set<string>;
  onToggle: (genre: string) => void;
}

export function GenreGrid({ selected, onToggle }: GenreGridProps) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {GENRES.map((genre) => {
        const isSelected = selected.has(genre);
        return (
          <Pressable
            key={genre}
            onPress={() => onToggle(genre)}
            className={`flex-row items-center gap-2 rounded-full border px-4 py-3 ${
              isSelected
                ? 'border-brand-300 bg-brand-400/20'
                : 'border-white/15 bg-white/5'
            }`}
          >
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={18} color="#67e8f9" />
            ) : null}
            <Text
              className={`text-base capitalize ${
                isSelected ? 'font-semibold text-white' : 'text-brand-100/80'
              }`}
            >
              {genre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
