export const colors = {
  ink: '#1a0f00',
  cream: '#fdf8f0',
  white: '#ffffff',
  amber: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#d97706' },
  teal: { light: '#ccfbf1', DEFAULT: '#0d9488' },
  green: { light: '#dcfce7', DEFAULT: '#16a34a' },
  rose: { light: '#fff1f2', DEFAULT: '#f43f5e' },
  blue: { light: '#eff6ff', DEFAULT: '#3b82f6' },
  purple: { light: '#f5f3ff', DEFAULT: '#8b5cf6' },
  warmGray: '#78716c',
  border: '#e7e0d4',
} as const;

export const fonts = {
  displayBold: 'PlayfairDisplay-Bold',
  displayBlack: 'PlayfairDisplay-Black',
  light: 'DMSans-Light',
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  semibold: 'DMSans-SemiBold',
  bold: 'DMSans-Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const borderRadius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 } as const;
