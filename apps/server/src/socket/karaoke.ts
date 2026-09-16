import { KaraokeSocketEvents } from "@musicapp/shared";
import type {
  KaraokeEndSessionPayload,
  KaraokeJoinRoomPayload,
  KaraokeSetMicPayload,
  KaraokeStartSingingPayload,
  KaraokeWebRTCAnswerPayload,
  KaraokeWebRTCIceCandidatePayload,
  KaraokeWebRTCOfferPayload,
} from "@musicapp/shared";
import {
  endKaraokeSession,
  getKaraokeMemberById,
  getKaraokeRoomDTOById,
  getKaraokeRoomRecord,
  getOnlineKaraokeMembers,
  isSinger,
  serializeKaraokeMember,
  setKaraokeMemberOnlineStatus,
  setKaraokeMic,
  startKaraokeSinging,
} from "../services/karaokeRoomService";
import { logger } from "../lib/logger";
import { HttpError } from "../lib/http-error";
import type { TypedServer, TypedSocket } from "../types/socket";

function karaokeSocketRoom(roomId: string): string {
  return `karaoke:${roomId}`;
}

// roomId -> (memberId -> socketId). Ephemeral, same tier/rationale as every other in-memory
// per-room map in socket/index.ts (presence, vote-skip, auto-end timers) — resets on server
// restart, acceptable for the single-instance deployment (see CLAUDE.md). This is purely a
// routing table for signaling: it never holds SDP/ICE payloads themselves, those are relayed
// through, never stored.
const socketIdByMember = new Map<string, Map<string, string>>();

function getRoomMemberSockets(roomId: string): Map<string, string> {
  let map = socketIdByMember.get(roomId);
  if (!map) {
    map = new Map();
    socketIdByMember.set(roomId, map);
  }
  return map;
}

export function registerKaraokeSocketHandlers(io: TypedServer) {
  io.on("connection", (socket: TypedSocket) => {
    socket.on(KaraokeSocketEvents.JOIN_KARAOKE_ROOM, async (payload: KaraokeJoinRoomPayload) => {
      try {
        const member = await getKaraokeMemberById(payload.memberId);
        if (!member || member.roomId !== payload.roomId) {
          socket.emit(KaraokeSocketEvents.KARAOKE_ERROR, { message: "Invalid member for this karaoke room" });
          return;
        }

        socket.data.karaokeRoomId = payload.roomId;
        socket.data.karaokeMemberId = payload.memberId;
        await socket.join(karaokeSocketRoom(payload.roomId));
        const updatedMember = await setKaraokeMemberOnlineStatus(payload.memberId, true);
        getRoomMemberSockets(payload.roomId).set(payload.memberId, socket.id);

        const room = await getKaraokeRoomDTOById(payload.roomId);
        socket.emit(KaraokeSocketEvents.KARAOKE_ROOM_STATE, { room });

        const members = await getOnlineKaraokeMembers(payload.roomId);
        socket.to(karaokeSocketRoom(payload.roomId)).emit(KaraokeSocketEvents.KARAOKE_MEMBER_JOINED, {
          member: serializeKaraokeMember(updatedMember),
          members,
        });
      } catch (err) {
        logger.error("karaoke-socket", "join_karaoke_room failed", err);
        socket.emit(KaraokeSocketEvents.KARAOKE_ERROR, { message: "Failed to join karaoke room" });
      }
    });

    socket.on(KaraokeSocketEvents.LEAVE_KARAOKE_ROOM, async (payload: { roomId: string }) => {
      await handleMemberLeave(io, socket, payload.roomId);
    });

    socket.on(KaraokeSocketEvents.KARAOKE_START_SINGING, async (payload: KaraokeStartSingingPayload) => {
      const { karaokeMemberId } = socket.data;
      if (!karaokeMemberId) return;
      try {
        const room = await getKaraokeRoomRecord(payload.roomId);
        if (!isSinger(room, karaokeMemberId)) {
          socket.emit(KaraokeSocketEvents.KARAOKE_ERROR, { message: "Only the singer can start the performance" });
          return;
        }
        const updated = await startKaraokeSinging(payload.roomId);
        io.to(karaokeSocketRoom(payload.roomId)).emit(KaraokeSocketEvents.KARAOKE_ROOM_STATE, { room: updated });
      } catch (err) {
        const message = err instanceof HttpError ? err.message : "Failed to start singing";
        if (!(err instanceof HttpError)) logger.error("karaoke-socket", "start_singing failed", err);
        socket.emit(KaraokeSocketEvents.KARAOKE_ERROR, { message });
      }
    });

    socket.on(KaraokeSocketEvents.KARAOKE_SET_MIC, async (payload: KaraokeSetMicPayload) => {
      const { karaokeMemberId } = socket.data;
      if (!karaokeMemberId) return;
      try {
        const room = await getKaraokeRoomRecord(payload.roomId);
        if (!isSinger(room, karaokeMemberId)) return;
        const updated = await setKaraokeMic(payload.roomId, payload.micOn);
        io.to(karaokeSocketRoom(payload.roomId)).emit(KaraokeSocketEvents.KARAOKE_ROOM_STATE, { room: updated });
      } catch (err) {
        logger.error("karaoke-socket", "set_mic failed", err);
      }
    });

    socket.on(KaraokeSocketEvents.KARAOKE_END_SESSION, async (payload: KaraokeEndSessionPayload) => {
      const { karaokeMemberId } = socket.data;
      if (!karaokeMemberId) return;
      try {
        const room = await getKaraokeRoomRecord(payload.roomId);
        if (!isSinger(room, karaokeMemberId)) {
          socket.emit(KaraokeSocketEvents.KARAOKE_ERROR, { message: "Only the singer can end the session" });
          return;
        }
        await endKaraokeSession(payload.roomId);
        io.to(karaokeSocketRoom(payload.roomId)).emit(KaraokeSocketEvents.KARAOKE_ROOM_ENDED, { roomId: payload.roomId });
        socketIdByMember.delete(payload.roomId);
      } catch (err) {
        const message = err instanceof HttpError ? err.message : "Failed to end session";
        if (!(err instanceof HttpError)) logger.error("karaoke-socket", "end_session failed", err);
        socket.emit(KaraokeSocketEvents.KARAOKE_ERROR, { message });
      }
    });

    // --- WebRTC signaling relay: pure pass-through, addressed by memberId. The server never
    // looks at SDP/ICE content, just routes it to the right socket. A singer holds one
    // RTCPeerConnection per listener (star topology, not a mesh — listeners never exchange
    // audio with each other) — see docs/karaoke-audio.md. ---

    socket.on(KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER, (payload: KaraokeWebRTCOfferPayload) => {
      const fromMemberId = socket.data.karaokeMemberId;
      const targetSocketId = fromMemberId && findMemberSocket(payload.roomId, payload.toMemberId);
      if (!fromMemberId || !targetSocketId) return;
      io.to(targetSocketId).emit(KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER_RECEIVED, { fromMemberId, sdp: payload.sdp });
    });

    socket.on(KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER, (payload: KaraokeWebRTCAnswerPayload) => {
      const fromMemberId = socket.data.karaokeMemberId;
      const targetSocketId = fromMemberId && findMemberSocket(payload.roomId, payload.toMemberId);
      if (!fromMemberId || !targetSocketId) return;
      io.to(targetSocketId).emit(KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER_RECEIVED, { fromMemberId, sdp: payload.sdp });
    });

    socket.on(KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE, (payload: KaraokeWebRTCIceCandidatePayload) => {
      const fromMemberId = socket.data.karaokeMemberId;
      const targetSocketId = fromMemberId && findMemberSocket(payload.roomId, payload.toMemberId);
      if (!fromMemberId || !targetSocketId) return;
      io.to(targetSocketId).emit(KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE_RECEIVED, {
        fromMemberId,
        candidate: payload.candidate,
      });
    });

    socket.on("disconnect", async () => {
      const { karaokeRoomId } = socket.data;
      if (!karaokeRoomId) return;
      await handleMemberLeave(io, socket, karaokeRoomId);
    });
  });
}

function findMemberSocket(roomId: string, memberId: string): string | undefined {
  const socketId = getRoomMemberSockets(roomId).get(memberId);
  if (!socketId) {
    logger.error("karaoke-socket", `signaling relay target not found: room=${roomId} to=${memberId}`);
  }
  return socketId;
}

async function handleMemberLeave(io: TypedServer, socket: TypedSocket, roomId: string) {
  const { karaokeMemberId } = socket.data;
  if (!karaokeMemberId) return;

  try {
    // Another tab/connection for the same member may still be open (mirrors socket/index.ts's
    // disconnect handler) — only treat this as a real departure if no other socket in the room
    // belongs to the same member.
    const socketsInRoom = await io.in(karaokeSocketRoom(roomId)).fetchSockets();
    const stillConnected = socketsInRoom.some((s) => s.data.karaokeMemberId === karaokeMemberId && s.id !== socket.id);
    if (stillConnected) {
      await socket.leave(karaokeSocketRoom(roomId));
      return;
    }

    await setKaraokeMemberOnlineStatus(karaokeMemberId, false);
    getRoomMemberSockets(roomId).delete(karaokeMemberId);
    await socket.leave(karaokeSocketRoom(roomId));

    const room = await getKaraokeRoomRecord(roomId);
    const wasSinger = isSinger(room, karaokeMemberId);

    if (wasSinger && room.status !== "ENDED") {
      // Singer leaving ends the room outright — no reassignment (unlike the listening room's
      // host-transfer-on-disconnect), since "singer" isn't a role a listener can just inherit;
      // per the spec: mark ended, listeners disconnect their WebRTC peers client-side on
      // receiving this.
      await endKaraokeSession(roomId);
      io.to(karaokeSocketRoom(roomId)).emit(KaraokeSocketEvents.KARAOKE_ROOM_ENDED, { roomId });
      socketIdByMember.delete(roomId);
      return;
    }

    const members = await getOnlineKaraokeMembers(roomId);
    io.to(karaokeSocketRoom(roomId)).emit(KaraokeSocketEvents.KARAOKE_MEMBER_LEFT, {
      memberId: karaokeMemberId,
      members,
      roomEnded: false,
    });
  } catch (err) {
    logger.error("karaoke-socket", "member leave handling failed", err);
  }
}
