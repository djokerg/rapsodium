import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GenreGrid } from '@/components/GenreGrid';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ApiError, apiFetch } from '@/lib/api';

const MIN_GENRES = 3;

export default function Onboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (genre: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  };

  const handleContinue = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch('/users/preferences', {
        method: 'PUT',
        body: Array.from(selected),
      });
      router.replace('/(app)/(tabs)');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not save preferences. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const count = selected.size;
  const canContinue = count >= MIN_GENRES && !submitting;

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#164e63', '#0891b2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}
        >
          <Text className="text-4xl font-bold text-white tracking-tight">
            What do you like?
          </Text>
          <Text className="mt-2 text-base text-brand-100/70">
            Pick at least {MIN_GENRES} genres to personalize your feed.
          </Text>

          <View className="mt-8">
            <GenreGrid selected={selected} onToggle={toggle} />
          </View>

          {error ? (
            <Text className="mt-6 text-center text-sm text-rose-300">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View className="px-6 pb-4">
          <Text className="mb-3 text-center text-sm text-brand-100/60">
            {count < MIN_GENRES
              ? `Select ${MIN_GENRES - count} more to continue`
              : `${count} selected`}
          </Text>
          <PrimaryButton
            label="Continue"
            onPress={handleContinue}
            loading={submitting}
            disabled={!canContinue}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
