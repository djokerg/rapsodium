import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SongDetailStub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#164e63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-2xl font-bold text-white">Song detail</Text>
          <Text className="mt-2 text-center text-sm text-brand-100/70">
            Coming soon (audio player + like/save/skip).
          </Text>
          <Text className="mt-6 text-xs text-brand-100/40">id: {id}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
