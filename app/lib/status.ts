import type { StatusLevel } from './types';

export const STATUS_META: Record<
  StatusLevel,
  { emoji: string; label: string; short: string }
> = {
  great:     { emoji: '😊', label: 'Feeling Great', short: 'Great' },
  okay:      { emoji: '🙂', label: 'Feeling Okay',  short: 'Okay' },
  not_great: { emoji: '😔', label: 'Not Great',     short: 'Not Great' },
  need_help: { emoji: '🆘', label: 'Need Help',     short: 'Need Help' },
};

export const STATUS_ORDER: StatusLevel[] = [
  'great',
  'okay',
  'not_great',
  'need_help',
];
