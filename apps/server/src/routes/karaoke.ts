import { Router } from "express";
import type {
  CreateKaraokeRoomRequest,
  CreateKaraokeRoomResponse,
  JoinKaraokeRoomRequest,
  JoinKaraokeRoomResponse,
  SelectKaraokeSongRequest,
} from "@musicapp/shared";
import { KaraokeSocketEvents } from "@musicapp/shared";
import {
  createKaraokeRoom,
  getKaraokeRoomDTOById,
  getKaraokeRoomIdByCode,
  isSinger,
  joinKaraokeRoom,
  getKaraokeRoomRecord,
  selectKaraokeSong,
} from "../services/karaokeRoomService";
import { requireKaraokeMember } from "../middleware/karaokeSessionAuth";
import { HttpError } from "../lib/http-error";
import type { TypedServer } from "../types/socket";

export function createKaraokeRouter(io: TypedServer): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const { displayName } = req.body as CreateKaraokeRoomRequest;
      if (!displayName?.trim()) {
        throw new HttpError(400, "displayName is required");
      }
      const result = await createKaraokeRoom(displayName.trim());
      res.status(201).json(result satisfies CreateKaraokeRoomResponse);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:code", async (req, res, next) => {
    try {
      const roomId = await getKaraokeRoomIdByCode(req.params.code);
      if (!roomId) throw new HttpError(404, `Karaoke room "${req.params.code}" not found`);
      const room = await getKaraokeRoomDTOById(roomId);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:code/join", async (req, res, next) => {
    try {
      const { displayName } = req.body as JoinKaraokeRoomRequest;
      if (!displayName?.trim()) {
        throw new HttpError(400, "displayName is required");
      }
      const result = await joinKaraokeRoom(req.params.code, displayName.trim());
      res.status(201).json(result satisfies JoinKaraokeRoomResponse);
    } catch (err) {
      next(err);
    }
  });

  // Song selection stays a REST call (like the listening room's add-song) since it needs the
  // YouTube metadata fetch; starting/stopping the performance and mic state are pure realtime
  // flag-flips and live on the socket layer instead (socket/karaoke.ts) — same split the
  // listening room already uses (REST for queue mutations, socket-only for END_ROOM/
  // SET_QUEUE_LOCK/TRANSFER_HOST).
  router.post("/:roomId/song", requireKaraokeMember, async (req, res, next) => {
    try {
      const { url, videoId, title, thumbnail, duration } = req.body as SelectKaraokeSongRequest;
      if (!url?.trim() && !videoId?.trim()) {
        throw new HttpError(400, "url or videoId is required");
      }

      const roomId = req.params.roomId;
      const room = await getKaraokeRoomRecord(roomId);
      if (!isSinger(room, req.karaokeMember!.id)) {
        throw new HttpError(403, "Only the singer can select a song");
      }

      const updated = await selectKaraokeSong(roomId, { url, videoId, title, thumbnail, duration });
      io.to(`karaoke:${roomId}`).emit(KaraokeSocketEvents.KARAOKE_ROOM_STATE, { room: updated });
      res.status(200).json({ room: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
