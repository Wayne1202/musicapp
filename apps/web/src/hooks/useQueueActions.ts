"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearQueue as clearQueueRequest,
  getErrorMessage,
  moveQueueItem as moveQueueItemRequest,
  removeFromQueue as removeFromQueueRequest,
  setRepeatQueue as setRepeatQueueRequest,
  shuffleQueue as shuffleQueueRequest,
} from "@/lib/api";

/**
 * Queue-mutation actions (remove/move/clear/shuffle/repeat). Each is a REST call — the
 * resulting queue arrives back to every client (including this one) via the `QUEUE_UPDATED`
 * socket event handled in useRoomSocket, so these mutations don't need to touch local state
 * themselves; they just fire the request and surface failures as toasts.
 */
export function useQueueActions(roomId: string | null, sessionId: string | null) {
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeFromQueueRequest(roomId!, sessionId!, itemId),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, direction }: { itemId: string; direction: "up" | "down" }) =>
      moveQueueItemRequest(roomId!, sessionId!, itemId, direction),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearQueueRequest(roomId!, sessionId!),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const shuffleMutation = useMutation({
    mutationFn: () => shuffleQueueRequest(roomId!, sessionId!),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const repeatMutation = useMutation({
    mutationFn: (enabled: boolean) => setRepeatQueueRequest(roomId!, sessionId!, enabled),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const ready = Boolean(roomId && sessionId);

  return {
    remove: (itemId: string) => ready && removeMutation.mutate(itemId),
    moveUp: (itemId: string) => ready && moveMutation.mutate({ itemId, direction: "up" }),
    moveDown: (itemId: string) => ready && moveMutation.mutate({ itemId, direction: "down" }),
    clear: () => ready && clearMutation.mutate(),
    shuffle: () => ready && shuffleMutation.mutate(),
    setRepeat: (enabled: boolean) => ready && repeatMutation.mutate(enabled),
    isClearing: clearMutation.isPending,
    isShuffling: shuffleMutation.isPending,
    isTogglingRepeat: repeatMutation.isPending,
  };
}
