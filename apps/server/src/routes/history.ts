import { Router } from "express";
import type { RecentlyPlayedResponse } from "@musicapp/shared";
import { getRecentlyPlayed } from "../services/recentlyPlayedService";

/** Read-only recently-played history, split out for the same reason routes/queue.ts was:
 *  a cohesive, small unit that doesn't belong bloating routes/rooms.ts. */
export function createHistoryRouter(): Router {
  const router = Router();

  router.get("/:roomId/recently-played", async (req, res, next) => {
    try {
      const items = await getRecentlyPlayed(req.params.roomId);
      res.json({ items } satisfies RecentlyPlayedResponse);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
