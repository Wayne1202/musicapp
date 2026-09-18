/**
 * STUN-only for MVP — no TURN relay. Works for most NATs (home wifi, most mobile carriers) but
 * will fail to connect across symmetric NATs / restrictive corporate networks where a TURN
 * relay would be required. Mirrors apps/mobile/src/lib/iceServers.ts exactly — see
 * docs/karaoke-audio.md "known limitations".
 */
export const KARAOKE_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
