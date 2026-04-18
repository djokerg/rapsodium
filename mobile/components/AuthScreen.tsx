import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AuthScreenProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#164e63', '#0891b2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 px-6 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Text className="text-lg text-white">‹</Text>
          </Pressable>

          <View className="mt-10">
            <Text className="text-4xl font-bold text-white tracking-tight">
              {title}
            </Text>
            <Text className="mt-2 text-base text-brand-100/70">{subtitle}</Text>
          </View>

          <View className="mt-10 gap-4">{children}</View>
        </View>
      </SafeAreaView>
    </View>
  );
}
