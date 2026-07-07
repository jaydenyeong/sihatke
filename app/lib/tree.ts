import type { TreeStage } from './types';

export const STAGE_META: Record<TreeStage, { name: string; emoji: string }> = {
  1: { name: 'Seed', emoji: '🌰' },
  2: { name: 'Sprout', emoji: '🌱' },
  3: { name: 'Sapling', emoji: '🌿' },
  4: { name: 'Young Tree', emoji: '🌳' },
  5: { name: 'Full Tree', emoji: '🌳' },
  6: { name: 'Blossoming', emoji: '🌸' },
};

/** Night = 19:00–06:59 local. */
export function isNightAt(hour: number): boolean {
  return hour >= 19 || hour < 7;
}
