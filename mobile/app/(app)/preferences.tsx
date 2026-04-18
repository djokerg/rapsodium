import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GenreGrid } from '@/components/GenreGrid';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ApiError, apiFetch } from '@/lib/api';

const MIN_GENRES = 3;

interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  preferences: { genre: string }[];
}

export default function Preferences() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const profile = await apiFetch<UserProfile>('/users/me');
        setSelected(new Set(profile.preferences.map((p) => p.genre)));
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not load your preferences.',
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

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

  const handleSave = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch('/users/preferences', {
        method: 'PUT',
        body: Array.from(selected),
      });
      router.back();
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
  const canSave = count >= MIN_GENRES && !submitting;

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#164e63', '#0891b2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="px-6 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Text className="text-lg text-white">‹</Text>
          </Pressable>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#67e8f9" />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingVertical: 24,
              }}
            >
              <Text className="text-4xl font-bold text-white tracking-tight">
                Your genres
              </Text>
              <Text className="mt-2 text-base text-brand-100/70">
                Update what you're into. At least {MIN_GENRES} required.
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
                  ? `Select ${MIN_GENRES - count} more to save`
                  : `${count} selected`}
              </Text>
              <PrimaryButton
                label="Save"
                onPress={handleSave}
                loading={submitting}
                disabled={!canSave}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
