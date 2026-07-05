import { Router } from "express";
import type { MoveQueueItemRequest, QueueMutationResponse, SetRepeatQueueRequest } from "@musicapp/shared";
import { SocketEvents } from "@musicapp/shared";
import {
  clearQueue,
  getQueue,
  moveQueueItem,
  removeQueueItem,
  setRepeatQueue,
  shuffleQueue,
} from "../services/queueService";
import { getRoomDTOById } from "../services/roomService";
import { requireSession } from "../middleware/sessionAuth";
import { HttpError } from "../lib/http-error";
import type { TypedServer } from "../types/socket";

/** Queue-management endpoints (remove/move/clear/shuffle/repeat), split out of routes/rooms.ts
 *  as that file's core create/join/add-song routes grew large enough to warrant separating
 *  this cohesive unit. Mounted at the same `/api/rooms` prefix by index.ts. */
export function createQueueRouter(io: TypedServer): Router {
  const router = Router();

  async function broadcastQueue(roomId: string) {
    const queue = await getQueue(roomId);
    io.to(roomId).emit(SocketEvents.QUEUE_UPDATED, { queue });
    return queue;
  }

  router.delete("/:roomId/queue/:itemId", requireSession, async (req, res, next) => {
    try {
      await removeQueueItem(req.params.roomId, req.params.itemId);
      const queue = await broadcastQueue(req.params.roomId);
      res.json({ queue } satisfies QueueMutationResponse);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:roomId/queue/:itemId/move", requireSession, async (req, res, next) => {
    try {
      const { direction } = req.body as MoveQueueItemRequest;
      if (direction !== "up" && direction !== "down") {
        throw new HttpError(400, 'direction must be "up" or "down"');
      }
      await moveQueueItem(req.params.roomId, req.params.itemId, direction);
      const queue = await broadcastQueue(req.params.roomId);
      res.json({ queue } satisfies QueueMutationResponse);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:roomId/queue/clear", requireSession, async (req, res, next) => {
    try {
      await clearQueue(req.params.roomId);
      const queue = await broadcastQueue(req.params.roomId);
      res.json({ queue } satisfies QueueMutationResponse);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:roomId/queue/shuffle", requireSession, async (req, res, next) => {
    try {
      await shuffleQueue(req.params.roomId);
      const queue = await broadcastQueue(req.params.roomId);
      res.json({ queue } satisfies QueueMutationResponse);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:roomId/repeat", requireSession, async (req, res, next) => {
    try {
      const { enabled } = req.body as SetRepeatQueueRequest;
      if (typeof enabled !== "boolean") {
        throw new HttpError(400, "enabled must be a boolean");
      }
      await setRepeatQueue(req.params.roomId, enabled);
      const room = await getRoomDTOById(req.params.roomId);
      io.to(req.params.roomId).emit(SocketEvents.ROOM_STATE, { room });
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
