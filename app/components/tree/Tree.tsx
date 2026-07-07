import { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { TreeStage } from '@/lib/types';
import type { TreePalette } from './palette';

interface TreeFigureProps {
  stage: TreeStage;
  fruitCount?: number;
  palette: TreePalette;
}

const BLOSSOM_SPOTS: [number, number][] = [
  [70, 66], [118, 32], [96, 76], [138, 60], [58, 80], [108, 18],
];

const FRUIT_SPOTS: [number, number][] = [
  [80, 52], [124, 44], [98, 88], [142, 76], [64, 94], [112, 60], [88, 30], [132, 92],
];

/**
 * SVG fragment for the tree. Coordinate space: 200×170, trunk base at
 * (100, 160). Embed inside a parent <Svg> via <G transform="...">.
 */
export function TreeFigure({ stage, fruitCount = 0, palette: p }: TreeFigureProps) {
  if (stage === 1) {
    return (
      <G>
        <Path d="M82 160 Q100 144 118 160 Z" fill={p.ground} />
        <Ellipse cx={100} cy={153} rx={6} ry={7} fill={p.trunk} />
      </G>
    );
  }

  if (stage === 2) {
    return (
      <G>
        <Path
          d="M100 160 C100 148 100 140 100 130"
          stroke={p.canopySide} strokeWidth={5} fill="none" strokeLinecap="round"
        />
        <Path d="M100 138 C88 132 82 122 82 112 C94 112 100 122 100 138 Z" fill={p.canopy} />
        <Path d="M100 128 C112 122 118 112 118 102 C106 102 100 112 100 128 Z" fill={p.canopySide} />
      </G>
    );
  }

  if (stage === 3) {
    return (
      <G>
        <Path d="M96 160 L96 108 Q100 100 104 108 L104 160 Z" fill={p.trunk} />
        <Circle cx={100} cy={86} r={30} fill={p.canopy} />
        <Circle cx={88} cy={76} r={9} fill={p.highlight} opacity={0.85} />
      </G>
    );
  }

  if (stage === 4) {
    return (
      <G>
        <Path d="M95 160 L95 96 Q100 86 105 96 L105 160 Z" fill={p.trunk} />
        <Circle cx={68} cy={88} r={22} fill={p.canopySide} />
        <Circle cx={132} cy={88} r={22} fill={p.canopySide} />
        <Circle cx={100} cy={64} r={32} fill={p.canopy} />
        <Circle cx={86} cy={54} r={10} fill={p.highlight} opacity={0.85} />
      </G>
    );
  }

  // Stages 5 and 6 share the full-tree silhouette
  return (
    <G>
      <Path d="M94 160 L94 88 Q100 78 106 88 L106 160 Z" fill={p.trunk} />
      <Path
        d="M100 104 Q84 96 74 82"
        stroke={p.trunk} strokeWidth={8} fill="none" strokeLinecap="round"
      />
      <Path
        d="M100 92 Q116 84 126 70"
        stroke={p.trunk} strokeWidth={8} fill="none" strokeLinecap="round"
      />
      <Circle cx={60} cy={78} r={30} fill={p.canopySide} />
      <Circle cx={140} cy={78} r={30} fill={p.canopySide} />
      <Circle cx={100} cy={52} r={44} fill={p.canopy} />
      <Circle cx={82} cy={38} r={13} fill={p.highlight} opacity={0.85} />
      {stage === 6 &&
        BLOSSOM_SPOTS.map(([x, y], i) => (
          <G key={`b${i}`}>
            <Circle cx={x} cy={y} r={5} fill={p.blossom} />
            <Circle cx={x} cy={y} r={1.8} fill={p.blossomCenter} />
          </G>
        ))}
      {stage === 6 &&
        FRUIT_SPOTS.slice(0, fruitCount).map(([x, y], i) => (
          <Circle key={`f${i}`} cx={x} cy={y} r={4.5} fill={p.fruit} />
        ))}
    </G>
  );
}
