import { Router } from "express";
import type { RecentlyPlayedResponse, RoomHistoryEntryDTO, RoomHistoryResponse } from "@musicapp/shared";
import { getRecentlyPlayed } from "../services/recentlyPlayedService";
import { getRoomEvents } from "../services/roomEventService";

/** Read-only recently-played + full room-history endpoints, split out for the same reason
 *  routes/queue.ts was: a cohesive, small unit that doesn't belong bloating routes/rooms.ts. */
export function createHistoryRouter(): Router {
  const router = Router();

  router.get("/:roomId/recently-played", async (req, res, next) => {
    try {
      // Quick-view modal defaults to the last 10; ?limit= lets other callers (e.g. the
      // combined Room History feed) ask for more, up to whatever recentlyPlayedService retains.
      const requested = Number(req.query.limit);
      const limit = Number.isInteger(requested) && requested > 0 ? requested : 10;
      const items = await getRecentlyPlayed(req.params.roomId, limit);
      res.json({ items } satisfies RecentlyPlayedResponse);
    } catch (err) {
      next(err);
    }
  });

  // Merges the structured event log (joins/leaves/host transfers/...) with songs played into
  // one time-sorted feed — both are already tracked separately (RoomEvent, RecentlyPlayedItem)
  // for their own reasons, so this just interleaves rather than duplicating either.
  router.get("/:roomId/history", async (req, res, next) => {
    try {
      const [events, songs] = await Promise.all([
        getRoomEvents(req.params.roomId),
        getRecentlyPlayed(req.params.roomId),
      ]);
      const entries: RoomHistoryEntryDTO[] = [
        ...events.map((event): RoomHistoryEntryDTO => ({ kind: "event", at: event.createdAt, event })),
        ...songs.map((song): RoomHistoryEntryDTO => ({ kind: "song", at: song.playedAt, song })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      res.json({ entries } satisfies RoomHistoryResponse);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
