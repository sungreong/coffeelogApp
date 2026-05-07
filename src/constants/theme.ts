export const palette = {
  crema: '#b77946',
  espresso: '#2f2118',
  milk: '#fffaf4',
  porcelain: '#f5eee6',
  sage: '#6f8f72',
  berry: '#a64d68',
  blue: '#3d6f91',
  amber: '#d59a3b',
  danger: '#c84630',
};

export const lightColors = {
  background: palette.milk,
  surface: '#ffffff',
  surfaceAlt: palette.porcelain,
  primary: palette.crema,
  primaryDark: '#8e5832',
  accent: palette.sage,
  danger: palette.danger,
  text: palette.espresso,
  textSecondary: '#735f50',
  textTertiary: '#9e8d7e',
  border: '#e1d5ca',
  badge: '#efe4d7',
};

export const darkColors = {
  background: '#17130f',
  surface: '#241c16',
  surfaceAlt: '#30251e',
  primary: '#d49a62',
  primaryDark: '#a76d3f',
  accent: '#8faf88',
  danger: '#ff806a',
  text: '#fff7ef',
  textSecondary: '#d9c7b8',
  textTertiary: '#a99789',
  border: '#4a3a30',
  badge: '#3b2b22',
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  page: 20,
  card: 14,
  radius: 8,
};
