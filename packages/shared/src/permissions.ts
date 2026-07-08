import type { QueueAddPermission, SkipMode } from "./types";

/**
 * Central home for "who's allowed to do X" — imported by both the server (REST routes,
 * socket handlers) and the web client (to disable/hide controls before a request even goes
 * out), so the rule is defined exactly once. Takes a flat context shape that both a raw
 * Prisma `Room` record and a client-side `{ hostSessionId, ...room.settings }` satisfy.
 */
export interface RoomPermissionContext {
  hostSessionId: string | null;
  queueAddPermission: QueueAddPermission;
  skipMode: SkipMode;
  allowGuestReorder: boolean;
  queueLocked: boolean;
}

export function isHost(room: RoomPermissionContext, sessionId: string): boolean {
  return room.hostSessionId === sessionId;
}

export function canAddSong(room: RoomPermissionContext, sessionId: string): boolean {
  if (room.queueLocked) return isHost(room, sessionId);
  if (room.queueAddPermission === "HOST_ONLY") return isHost(room, sessionId);
  return true;
}

/** Governs remove / move (up-down) / drag-reorder — the "guest queue editing rights" the
 *  spec's "Allow guests to reorder queue" setting refers to. */
export function canEditQueue(room: RoomPermissionContext, sessionId: string): boolean {
  if (room.queueLocked) return isHost(room, sessionId);
  return isHost(room, sessionId) || room.allowGuestReorder;
}

/** Shuffle and clear are destructive/global queue actions — host-only, always. */
export function canShuffleOrClear(room: RoomPermissionContext, sessionId: string): boolean {
  return isHost(room, sessionId);
}

export function canSkipInstantly(room: RoomPermissionContext, sessionId: string): boolean {
  if (room.skipMode === "ANYONE") return true;
  if (room.skipMode === "HOST_ONLY") return isHost(room, sessionId);
  return false; // VOTE: nobody skips instantly, must go through a vote
}

export function canChangeRoomSettings(room: RoomPermissionContext, sessionId: string): boolean {
  return isHost(room, sessionId);
}
