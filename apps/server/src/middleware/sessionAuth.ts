import type { NextFunction, Request, Response } from "express";
import type { UserSession } from "@prisma/client";
import { getSessionById } from "../services/roomService";
import { HttpError } from "../lib/http-error";

declare global {
  namespace Express {
    interface Request {
      session?: UserSession;
    }
  }
}

/** Reads the `x-session-id` header, loads the guest session, and ensures it belongs to :roomId. */
export async function requireSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const sessionId = req.header("x-session-id");
    if (!sessionId) {
      throw new HttpError(401, "Missing x-session-id header");
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      throw new HttpError(401, "Unknown session");
    }

    const roomId = req.params.roomId;
    if (roomId && session.roomId !== roomId) {
      throw new HttpError(403, "Session does not belong to this room");
    }

    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}
