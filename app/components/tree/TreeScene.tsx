import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { SunshineReceived, TreeStage } from '@/lib/types';
import { TreeFigure } from './Tree';
import { DAY_PALETTE, paletteForDate } from './palette';
import { Petal } from './Petal';

interface TreeSceneProps {
  stage: TreeStage;
  fruitCount: number;
  streak: number;
  sunshines: SunshineReceived[];
  size: 'hero' | 'mini';
  celebrate?: boolean;
  onTreePress?: () => void;
  accessibilityLabel?: string;
}

const HERO_HEIGHT = 190;
const PETAL_COUNT = 6;

function firstName(full: string): string {
  return full.split(' ')[0];
}

function SunshineSun({ name, index }: { name: string; index: number }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(index * 250, withSpring(1, { damping: 9 }));
  }, [index, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.sun, { left: 18 + index * 64, top: 6 + (index % 2) * 14 }, style]}>
      <Text style={styles.sunEmoji}>☀️</Text>
      <Text style={styles.sunName}>{name}</Text>
    </Animated.View>
  );
}

export function TreeScene({
  stage,
  fruitCount,
  streak,
  sunshines,
  size,
  celebrate = false,
  onTreePress,
  accessibilityLabel,
}: TreeSceneProps) {
  const palette = size === 'mini' ? DAY_PALETTE : paletteForDate();

  const sway = useSharedValue(0);
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (size === 'hero') {
      sway.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
    }
  }, [size, sway]);

  useEffect(() => {
    if (celebrate) {
      bounce.value = withSequence(
        withSpring(1.15, { damping: 5 }),
        withSpring(1, { damping: 8 })
      );
    }
  }, [bounce, celebrate]);

  const treeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value * 1.2}deg` }, { scale: bounce.value }],
  }));

  if (size === 'mini') {
    return (
      <View style={styles.mini} accessibilityLabel={accessibilityLabel}>
        <Svg width={64} height={60} viewBox="0 0 200 190">
          <Ellipse cx={100} cy={172} rx={72} ry={9} fill={palette.ground} />
          <G transform="translate(0, 12)">
            <TreeFigure stage={stage} fruitCount={fruitCount} palette={palette} />
          </G>
        </Svg>
      </View>
    );
  }

  const shownSunshines = sunshines.slice(0, 3);

  return (
    <View
      style={{ height: HERO_HEIGHT, width: '100%' }}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onTreePress ? 'button' : undefined}
      onAccessibilityTap={onTreePress}
    >
      {/* Static layer: celestial + ground */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 210" preserveAspectRatio="xMidYMax meet">
        {palette.night ? (
          <>
            <Path d="M272 26 A17 17 0 1 0 284 54 A13 13 0 0 1 272 26 Z" fill={palette.celestial} />
            <Circle cx={48} cy={30} r={1.8} fill="#FFFFFF" opacity={0.9} />
            <Circle cx={86} cy={16} r={1.4} fill="#FFFFFF" opacity={0.7} />
            <Circle cx={200} cy={22} r={1.6} fill="#FFFFFF" opacity={0.8} />
            <Circle cx={130} cy={34} r={1.2} fill="#FFFFFF" opacity={0.6} />
            <Circle cx={36} cy={70} r={1.4} fill="#FFFFFF" opacity={0.7} />
          </>
        ) : (
          <>
            <Circle cx={276} cy={40} r={15} fill={palette.celestial} />
            <Circle cx={276} cy={40} r={22} fill={palette.celestial} opacity={0.35} />
          </>
        )}
        <Ellipse cx={160} cy={196} rx={122} ry={13} fill={palette.ground} />
      </Svg>

      {/* Animated tree layer */}
      <Animated.View style={[StyleSheet.absoluteFill, treeStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onTreePress}
          disabled={!onTreePress}
        >
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 210" preserveAspectRatio="xMidYMax meet">
            <G transform="translate(60, 32)">
              <TreeFigure stage={stage} fruitCount={fruitCount} palette={palette} />
            </G>
            {streak >= 7 && (
              <G transform="translate(208, 62)">
                <Ellipse cx={0} cy={0} rx={8} ry={6} fill="#F4845F" />
                <Circle cx={6} cy={-4} r={4.5} fill="#F4845F" />
                <Circle cx={7.5} cy={-5} r={1} fill="#1A1A1A" />
                <Path d="M10 -3.5 L15 -2.5 L10 -1.5 Z" fill="#FFD166" />
              </G>
            )}
            {streak >= 30 && (
              <G transform="translate(92, 48)">
                <Ellipse cx={-3} cy={0} rx={4} ry={6} fill={palette.blossom} transform="rotate(-24)" />
                <Ellipse cx={3} cy={0} rx={4} ry={6} fill={palette.blossom} transform="rotate(24)" />
                <Ellipse cx={0} cy={1} rx={1.4} ry={4.5} fill="#1A1A1A" opacity={0.7} />
              </G>
            )}
          </Svg>
        </Pressable>
      </Animated.View>

      {/* Sunshine suns from the circle */}
      {shownSunshines.map((s, i) => (
        <SunshineSun key={`${s.fromName}-${s.createdAt}`} name={firstName(s.fromName)} index={i} />
      ))}

      {/* One-shot petal celebration */}
      {celebrate &&
        Array.from({ length: PETAL_COUNT }, (_, i) => (
          <Petal key={i} index={i} left={60 + i * 36} top={20 + (i % 3) * 10} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mini: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sun: {
    position: 'absolute',
    alignItems: 'center',
  },
  sunEmoji: { fontSize: 18 },
  sunName: { fontSize: 10, fontWeight: '700', color: '#B45309' },
});
