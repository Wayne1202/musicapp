import { Router } from "express";
import type {
  AddSongResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
} from "@musicapp/shared";
import { SocketEvents, canAddSong } from "@musicapp/shared";
import { createRoom, getRoomDTOById, getRoomIdByCode, getRoomRecord, joinRoomByCode } from "../services/roomService";
import { addSongFromUrl, getQueue } from "../services/queueService";
import { getLivePlaybackState } from "../services/playbackService";
import { requireSession } from "../middleware/sessionAuth";
import { HttpError } from "../lib/http-error";
import type { TypedServer } from "../types/socket";

export function createRoomsRouter(io: TypedServer): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const { roomName, displayName } = req.body as CreateRoomRequest;
      if (!roomName?.trim() || !displayName?.trim()) {
        throw new HttpError(400, "roomName and displayName are required");
      }
      const result = await createRoom(roomName.trim(), displayName.trim());
      res.status(201).json(result satisfies CreateRoomResponse);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:code", async (req, res, next) => {
    try {
      const roomId = await getRoomIdByCode(req.params.code);
      if (!roomId) throw new HttpError(404, `Room "${req.params.code}" not found`);
      const room = await getRoomDTOById(roomId);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:code/join", async (req, res, next) => {
    try {
      const { displayName } = req.body as JoinRoomRequest;
      if (!displayName?.trim()) {
        throw new HttpError(400, "displayName is required");
      }
      const result = await joinRoomByCode(req.params.code, displayName.trim());
      res.status(201).json(result satisfies JoinRoomResponse);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:roomId/queue", requireSession, async (req, res, next) => {
    try {
      const { url } = req.body as { url: string };
      if (!url?.trim()) {
        throw new HttpError(400, "url is required");
      }

      const roomId = req.params.roomId;
      const sessionId = req.session!.id;

      const room = await getRoomRecord(roomId);
      if (!canAddSong(room, sessionId)) {
        throw new HttpError(403, "Only the host can add songs to this room right now");
      }

      const { queueItem, startedImmediately } = await addSongFromUrl(
        roomId,
        sessionId,
        req.session!.displayName,
        url.trim(),
      );

      if (startedImmediately) {
        const playbackState = await getLivePlaybackState(roomId);
        const queue = await getQueue(roomId);
        io.to(roomId).emit(SocketEvents.SONG_CHANGED, { playbackState, queue });
        res.status(201).json({ queueItem: null } satisfies AddSongResponse);
        return;
      }

      const queue = await getQueue(roomId);
      io.to(roomId).emit(SocketEvents.SONG_ADDED, { queueItem: queueItem!, queue });
      res.status(201).json({ queueItem } satisfies AddSongResponse);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:roomId/queue", async (req, res, next) => {
    try {
      const queue = await getQueue(req.params.roomId);
      res.json({ queue });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
