import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface PetalProps {
  index: number;
  left: number;
  top: number;
}

/** A single falling blossom petal. Animates once on mount, staggered by index. */
export function Petal({ index, left, top }: PetalProps) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      index * 120,
      withTiming(1, {
        duration: 1600,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [fall, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [
      { translateY: fall.value * 130 },
      { translateX: Math.sin(index) * 24 * fall.value },
    ],
  }));
  return <Animated.View style={[styles.petal, { left, top }, style]} />;
}

const styles = StyleSheet.create({
  petal: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFB7C5',
  },
});
