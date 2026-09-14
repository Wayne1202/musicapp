/** Dark-mode-first palette mirroring apps/web/src/app/globals.css's CSS variables 1:1
 *  (converted from HSL to hex) so the mobile app reads as the same product as the web app. */
export const colors = {
  background: "#09090b",
  foreground: "#fafafa",
  card: "#18181b",
  primary: "#21c45d",
  primaryForeground: "#082112",
  secondary: "#27272a",
  muted: "#27272a",
  mutedForeground: "#a1a1aa",
  destructive: "#dc2828",
  border: "#313135",
  input: "#313135",
  ring: "#21c45d",
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
