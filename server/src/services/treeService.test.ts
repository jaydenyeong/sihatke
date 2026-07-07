import { describe, expect, it } from 'vitest';
import {
  canSendSunshine,
  nextAllowedAt,
  treeStateFor,
} from './treeService';

describe('treeStateFor', () => {
  it.each([
    [0, 1], [4, 1],
    [5, 2], [24, 2],
    [25, 3], [59, 3],
    [60, 4], [119, 4],
    [120, 5], [199, 5],
    [200, 6], [999, 6],
  ])('%i check-ins → stage %i', (total, stage) => {
    expect(treeStateFor(total).stage).toBe(stage);
  });

  it('reports check-ins remaining to the next stage', () => {
    expect(treeStateFor(0).toNextStage).toBe(5);
    expect(treeStateFor(5).toNextStage).toBe(20);
    expect(treeStateFor(128).toNextStage).toBe(72);
    expect(treeStateFor(199).toNextStage).toBe(1);
  });

  it('has no next stage at Blossoming', () => {
    expect(treeStateFor(200).toNextStage).toBeNull();
    expect(treeStateFor(500).toNextStage).toBeNull();
  });

  it('grows one fruit per 25 check-ins past 200, capped at 8', () => {
    expect(treeStateFor(199).fruitCount).toBe(0);
    expect(treeStateFor(200).fruitCount).toBe(0);
    expect(treeStateFor(224).fruitCount).toBe(0);
    expect(treeStateFor(225).fruitCount).toBe(1);
    expect(treeStateFor(400).fruitCount).toBe(8);
    expect(treeStateFor(9999).fruitCount).toBe(8);
  });
});

describe('canSendSunshine', () => {
  const now = new Date('2026-07-07T12:00:00Z');

  it('allows when never sent before', () => {
    expect(canSendSunshine(null, now)).toBe(true);
  });

  it('blocks within 20 hours', () => {
    expect(canSendSunshine('2026-07-07T11:00:00Z', now)).toBe(false);
    expect(canSendSunshine('2026-07-06T16:00:01Z', now)).toBe(false);
  });

  it('allows at exactly 20 hours and beyond', () => {
    expect(canSendSunshine('2026-07-06T16:00:00Z', now)).toBe(true);
    expect(canSendSunshine('2026-07-01T00:00:00Z', now)).toBe(true);
  });
});

describe('nextAllowedAt', () => {
  it('is lastSentAt + 20 hours', () => {
    expect(nextAllowedAt('2026-07-07T11:00:00Z')).toBe('2026-07-08T07:00:00.000Z');
  });
});
