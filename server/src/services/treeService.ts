export type TreeStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface TreeState {
  stage: TreeStage;
  /** Check-ins remaining until the next stage; null at Blossoming. */
  toNextStage: number | null;
  /** 0–8 fruit, only ever non-zero at Blossoming. */
  fruitCount: number;
}

/** Lifetime check-ins needed to reach stage index+1. */
export const STAGE_THRESHOLDS = [0, 5, 25, 60, 120, 200] as const;

const FRUIT_INTERVAL = 25;
const FRUIT_MAX = 8;

export function treeStateFor(totalCheckins: number): TreeState {
  let stage: TreeStage = 1;
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalCheckins >= STAGE_THRESHOLDS[i]) {
      stage = (i + 1) as TreeStage;
      break;
    }
  }
  const toNextStage =
    stage === 6 ? null : STAGE_THRESHOLDS[stage] - totalCheckins;
  const fruitCount =
    stage === 6
      ? Math.min(FRUIT_MAX, Math.floor((totalCheckins - 200) / FRUIT_INTERVAL))
      : 0;
  return { stage, toNextStage, fruitCount };
}

export const SUNSHINE_COOLDOWN_HOURS = 20;
const COOLDOWN_MS = SUNSHINE_COOLDOWN_HOURS * 60 * 60 * 1000;

export function canSendSunshine(
  lastSentAt: string | null,
  now: Date = new Date()
): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - new Date(lastSentAt).getTime() >= COOLDOWN_MS;
}

export function nextAllowedAt(lastSentAt: string): string {
  return new Date(new Date(lastSentAt).getTime() + COOLDOWN_MS).toISOString();
}
