export const theme = {
  primary: '#2E9E6E',
  primaryLight: '#E8F5EE',
  cta: '#F4845F',
  background: '#EFEFEF',
  card: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#EF4444',
  border: '#E5E7EB',
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
};

export default {
  light: {
    text: theme.textPrimary,
    background: theme.background,
    tint: theme.primary,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: theme.primary,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: '#fff',
    tabIconDefault: '#ccc',
    tabIconSelected: '#fff',
  },
};
