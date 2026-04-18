import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';

export default function Home() {
  const router = useRouter();
  const clearToken = useAuthStore((s) => s.clearToken);

  const handleLogout = async (): Promise<void> => {
    await clearToken();
    router.replace('/');
  };

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-4xl font-bold text-white">You're in 🎉</Text>
          <Text className="mt-3 text-center text-base text-brand-100/80">
            Home feed, search, favorites, and history are on the way.
          </Text>
        </View>

        <View className="px-6 pb-6">
          <Pressable
            onPress={handleLogout}
            className="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-4 active:bg-white/10"
          >
            <Text className="text-center text-base font-semibold text-white">
              Log out
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
