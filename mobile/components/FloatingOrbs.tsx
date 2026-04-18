import { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface OrbConfig {
  size: number;
  color: string;
  opacity: number;
  xFrom: number;
  xTo: number;
  yFrom: number;
  yTo: number;
  xDurationMs: number;
  yDurationMs: number;
}

function Orb({ config }: { config: OrbConfig }) {
  const x = useSharedValue(config.xFrom);
  const y = useSharedValue(config.yFrom);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(config.xTo, {
        duration: config.xDurationMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    y.value = withRepeat(
      withTiming(config.yTo, {
        duration: config.yDurationMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [config, x, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          opacity: config.opacity,
        },
        style,
      ]}
    />
  );
}

export function FloatingOrbs() {
  const { width, height } = Dimensions.get('window');

  const orbs: OrbConfig[] = [
    {
      size: 320,
      color: '#22d3ee',
      opacity: 0.28,
      xFrom: -80,
      xTo: width - 220,
      yFrom: -60,
      yTo: height * 0.35,
      xDurationMs: 14000,
      yDurationMs: 17000,
    },
    {
      size: 260,
      color: '#0891b2',
      opacity: 0.35,
      xFrom: width - 180,
      xTo: -40,
      yFrom: height * 0.45,
      yTo: height * 0.15,
      xDurationMs: 18000,
      yDurationMs: 13000,
    },
    {
      size: 220,
      color: '#67e8f9',
      opacity: 0.22,
      xFrom: width * 0.15,
      xTo: width * 0.55,
      yFrom: height * 0.7,
      yTo: height * 0.55,
      xDurationMs: 11000,
      yDurationMs: 15000,
    },
  ];

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {orbs.map((config, i) => (
        <Orb key={i} config={config} />
      ))}
    </View>
  );
}
