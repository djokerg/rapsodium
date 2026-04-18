import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Welcome() {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const buttonsTranslate = useSharedValue(40);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 700 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    buttonsOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    buttonsTranslate.value = withDelay(
      400,
      withSpring(0, { damping: 14, stiffness: 120 }),
    );
  }, [logoOpacity, logoScale, buttonsOpacity, buttonsTranslate]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslate.value }],
  }));

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0e7490', '#22d3ee']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 justify-between px-8 py-12">
          <Animated.View
            style={logoStyle}
            className="flex-1 items-center justify-center"
          >
            <View className="h-24 w-24 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-lg">
              <Text className="text-5xl">♫</Text>
            </View>
            <Text className="mt-6 text-5xl font-bold text-white tracking-tight">
              Rapsodium
            </Text>
            <Text className="mt-3 text-center text-base text-brand-100/80">
              Discover music tuned to your taste.
            </Text>
          </Animated.View>

          <Animated.View style={buttonsStyle} className="gap-3">
            <Link href="/(auth)/register" asChild>
              <Pressable className="w-full rounded-2xl bg-brand-400 px-6 py-4 active:bg-brand-500">
                <Text className="text-center text-base font-semibold text-ink-950">
                  Create account
                </Text>
              </Pressable>
            </Link>
            <Link href="/(auth)/login" asChild>
              <Pressable className="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-4 active:bg-white/10">
                <Text className="text-center text-base font-semibold text-white">
                  I already have an account
                </Text>
              </Pressable>
            </Link>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
