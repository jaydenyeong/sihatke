import type { StatusLevel } from './types';

export const STATUS_META: Record<
  StatusLevel,
  { emoji: string; label: string; short: string; color: string; bgColor: string }
> = {
  great:     { emoji: '😊', label: 'Feeling Great', short: 'Great',    color: '#16A34A', bgColor: '#DCFCE7' },
  okay:      { emoji: '🙂', label: 'Feeling Okay',  short: 'Okay',     color: '#D97706', bgColor: '#FEF3C7' },
  not_great: { emoji: '😔', label: 'Not Great',     short: 'Not Great', color: '#EA580C', bgColor: '#FFEDD5' },
  need_help: { emoji: '🆘', label: 'Need Help',     short: 'Need Help', color: '#DC2626', bgColor: '#FEE2E2' },
};

export const STATUS_ORDER: StatusLevel[] = [
  'great',
  'okay',
  'not_great',
  'need_help',
];
