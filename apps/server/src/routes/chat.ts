import { Router } from "express";
import type { ChatHistoryResponse } from "@musicapp/shared";
import { getRecentMessages } from "../services/chatService";

/** Chat history only — sending happens over the socket (see socket/index.ts's SEND_MESSAGE
 *  handler), matching the "real-time via Socket.IO" requirement for actually posting. */
export function createChatRouter(): Router {
  const router = Router();

  router.get("/:roomId/messages", async (req, res, next) => {
    try {
      const messages = await getRecentMessages(req.params.roomId);
      res.json({ messages } satisfies ChatHistoryResponse);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
