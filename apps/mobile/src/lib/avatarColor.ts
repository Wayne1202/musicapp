// Deterministic per-user color, same idea as Slack/Discord's colored initials — no accounts,
// no stored preference, just a stable hash of an id/name into a fixed palette. Same palette as
// apps/web/src/lib/avatarColor.ts (Tailwind's rose/amber/emerald/cyan/blue/violet/pink/orange
// 500 shades), as hex since there's no Tailwind here.
const AVATAR_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f97316"];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
