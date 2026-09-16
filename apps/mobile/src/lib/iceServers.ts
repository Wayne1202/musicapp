/**
 * STUN-only for MVP — no TURN relay. Works for most NATs (home wifi, most mobile carriers) but
 * will fail to connect across symmetric NATs / restrictive corporate networks where a TURN
 * relay would be required. See docs/karaoke-audio.md "known limitations" — this is a documented,
 * deliberate MVP simplification (a TURN server is real infrastructure to run/pay for, out of
 * scope per the task spec's "do not build production-scale infrastructure").
 */
export const KARAOKE_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
