import { REACTION_EMOJIS } from "@musicapp/shared";
import type { ReactionEmoji } from "@musicapp/shared";
import { HttpError } from "../lib/http-error";

const REACTION_SET = new Set<string>(REACTION_EMOJIS);

// Ephemeral, stateless-ish: reactions aren't persisted (they're floating animations that
// disappear), but a light per-session cooldown stops a held-down button from flooding the
// room — same in-memory-Map tier as the other per-room debounce state in socket/index.ts.
const lastReactionAtBySession = new Map<string, number>();
const REACTION_COOLDOWN_MS = 400;

export function assertValidReaction(emoji: string): asserts emoji is ReactionEmoji {
  if (!REACTION_SET.has(emoji)) {
    throw new HttpError(400, "Unsupported reaction emoji");
  }
}

export function isReactionAllowed(sessionId: string): boolean {
  const now = Date.now();
  const last = lastReactionAtBySession.get(sessionId) ?? 0;
  if (now - last < REACTION_COOLDOWN_MS) return false;
  lastReactionAtBySession.set(sessionId, now);
  return true;
}
