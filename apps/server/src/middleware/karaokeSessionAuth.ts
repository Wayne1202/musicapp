import type { NextFunction, Request, Response } from "express";
import type { KaraokeMember } from "@prisma/client";
import { getKaraokeMemberById } from "../services/karaokeRoomService";
import { HttpError } from "../lib/http-error";

declare global {
  namespace Express {
    interface Request {
      karaokeMember?: KaraokeMember;
    }
  }
}

/** Mirrors middleware/sessionAuth.ts, checking against KaraokeMember instead of UserSession —
 *  a separate guest identity per PROJECT_KARAOKE.md, not a shared one. Reads the same
 *  `x-session-id` header convention (the header name is generic; what it identifies depends on
 *  which route it's used on). */
export async function requireKaraokeMember(req: Request, _res: Response, next: NextFunction) {
  try {
    const memberId = req.header("x-session-id");
    if (!memberId) {
      throw new HttpError(401, "Missing x-session-id header");
    }

    const member = await getKaraokeMemberById(memberId);
    if (!member) {
      throw new HttpError(401, "Unknown karaoke member");
    }

    const roomId = req.params.roomId;
    if (roomId && member.roomId !== roomId) {
      throw new HttpError(403, "Member does not belong to this karaoke room");
    }

    req.karaokeMember = member;
    next();
  } catch (err) {
    next(err);
  }
}
