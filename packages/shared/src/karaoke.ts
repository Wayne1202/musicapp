// Karaoke: a separate room type from Room/PlaybackState in types.ts — singer + listeners + live
// mic audio, not a shared YouTube queue. See PROJECT_KARAOKE.md for the full rationale. Kept in
// its own module (rather than folded into types.ts/socket-events.ts) since it's a self-contained
// addition with its own event namespace.

export type KaraokeRoomStatus = "WAITING" | "SINGING" | "ENDED";
export type KaraokeRole = "SINGER" | "LISTENER";

export interface KaraokeMemberDTO {
  id: string;
  roomId: string;
  displayName: string;
  role: KaraokeRole;
  isOnline: boolean;
  createdAt: string;
}

/**
 * Deliberately shaped like PlaybackStateDTO (types.ts) for its currentVideoId/Title/Thumbnail/
 * Duration/Timestamp/isPlaying/updatedAt fields — this lets projectPlaybackPosition() (below,
 * playback.ts) work on a KaraokeRoomDTO exactly as it does on a PlaybackStateDTO, so the karaoke
 * backing track reuses the same drift-corrected sync strategy as the listening room, verbatim.
 */
export interface KaraokeRoomDTO {
  id: string;
  code: string;
  status: KaraokeRoomStatus;
  singerMemberId: string | null;
  currentVideoId: string | null;
  currentTitle: string | null;
  currentThumbnail: string | null;
  currentDuration: number;
  currentTimestamp: number;
  isPlaying: boolean;
  micOn: boolean;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  members: KaraokeMemberDTO[];
}

export interface CreateKaraokeRoomRequest {
  displayName: string;
}
export interface CreateKaraokeRoomResponse {
  room: KaraokeRoomDTO;
  member: KaraokeMemberDTO;
}

export interface JoinKaraokeRoomRequest {
  displayName: string;
}
export interface JoinKaraokeRoomResponse {
  room: KaraokeRoomDTO;
  member: KaraokeMemberDTO;
}

/** Exactly one of `url` / `videoId` — mirrors AddSongRequest's shape in types.ts. */
export interface SelectKaraokeSongRequest {
  url?: string;
  videoId?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
}

// Minimal structural stand-in for the DOM's RTCIceCandidateInit — avoids depending on the "dom"
// TS lib (not available/appropriate in the server's or React Native's tsconfig) while staying
// wire-compatible with what both react-native-webrtc and browser WebRTC actually send.
export interface IceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export const KaraokeSocketEvents = {
  // --- Client -> Server ---
  JOIN_KARAOKE_ROOM: "karaoke_join_room",
  LEAVE_KARAOKE_ROOM: "karaoke_leave_room",
  KARAOKE_SELECT_SONG: "karaoke_select_song",
  KARAOKE_START_SINGING: "karaoke_start_singing",
  KARAOKE_END_SESSION: "karaoke_end_session",
  KARAOKE_SET_MIC: "karaoke_set_mic",
  KARAOKE_WEBRTC_OFFER: "karaoke_webrtc_offer",
  KARAOKE_WEBRTC_ANSWER: "karaoke_webrtc_answer",
  KARAOKE_WEBRTC_ICE_CANDIDATE: "karaoke_webrtc_ice_candidate",

  // --- Server -> Client ---
  KARAOKE_ROOM_STATE: "karaoke_room_state",
  KARAOKE_MEMBER_JOINED: "karaoke_member_joined",
  KARAOKE_MEMBER_LEFT: "karaoke_member_left",
  KARAOKE_ROOM_ENDED: "karaoke_room_ended",
  KARAOKE_WEBRTC_OFFER_RECEIVED: "karaoke_webrtc_offer_received",
  KARAOKE_WEBRTC_ANSWER_RECEIVED: "karaoke_webrtc_answer_received",
  KARAOKE_WEBRTC_ICE_CANDIDATE_RECEIVED: "karaoke_webrtc_ice_candidate_received",
  KARAOKE_ERROR: "karaoke_error_event",
} as const;

export interface KaraokeJoinRoomPayload {
  roomId: string;
  memberId: string;
}

export interface KaraokeRoomStatePayload {
  room: KaraokeRoomDTO;
}

export interface KaraokeMemberJoinedPayload {
  member: KaraokeMemberDTO;
  members: KaraokeMemberDTO[];
}

export interface KaraokeMemberLeftPayload {
  memberId: string;
  members: KaraokeMemberDTO[];
  /** True when the departing member was the singer — listeners use this to distinguish
   *  "a listener left" (no-op for them) from "the room is over". */
  roomEnded: boolean;
}

export interface KaraokeRoomEndedPayload {
  roomId: string;
}

export interface KaraokeSelectSongPayload extends SelectKaraokeSongRequest {
  roomId: string;
}

export interface KaraokeStartSingingPayload {
  roomId: string;
}

export interface KaraokeEndSessionPayload {
  roomId: string;
}

export interface KaraokeSetMicPayload {
  roomId: string;
  micOn: boolean;
}

/** Client -> server: `toMemberId` tells the server which single socket to relay this to (the
 *  server looks up that member's current socket id from its in-memory room map — see
 *  apps/server/src/socket/karaoke.ts). */
export interface KaraokeWebRTCOfferPayload {
  roomId: string;
  toMemberId: string;
  sdp: string;
}
export interface KaraokeWebRTCAnswerPayload {
  roomId: string;
  toMemberId: string;
  sdp: string;
}
export interface KaraokeWebRTCIceCandidatePayload {
  roomId: string;
  toMemberId: string;
  candidate: IceCandidateInit;
}

/** Server -> client: the relayed version has `fromMemberId` instead of `toMemberId`, so the
 *  recipient knows which peer connection (singer has one per listener) this belongs to. */
export interface KaraokeWebRTCOfferReceivedPayload {
  fromMemberId: string;
  sdp: string;
}
export interface KaraokeWebRTCAnswerReceivedPayload {
  fromMemberId: string;
  sdp: string;
}
export interface KaraokeWebRTCIceCandidateReceivedPayload {
  fromMemberId: string;
  candidate: IceCandidateInit;
}

export interface KaraokeErrorPayload {
  message: string;
}

export interface KaraokeServerToClientEvents {
  [KaraokeSocketEvents.KARAOKE_ROOM_STATE]: (payload: KaraokeRoomStatePayload) => void;
  [KaraokeSocketEvents.KARAOKE_MEMBER_JOINED]: (payload: KaraokeMemberJoinedPayload) => void;
  [KaraokeSocketEvents.KARAOKE_MEMBER_LEFT]: (payload: KaraokeMemberLeftPayload) => void;
  [KaraokeSocketEvents.KARAOKE_ROOM_ENDED]: (payload: KaraokeRoomEndedPayload) => void;
  [KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER_RECEIVED]: (payload: KaraokeWebRTCOfferReceivedPayload) => void;
  [KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER_RECEIVED]: (payload: KaraokeWebRTCAnswerReceivedPayload) => void;
  [KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE_RECEIVED]: (payload: KaraokeWebRTCIceCandidateReceivedPayload) => void;
  [KaraokeSocketEvents.KARAOKE_ERROR]: (payload: KaraokeErrorPayload) => void;
}

export interface KaraokeClientToServerEvents {
  [KaraokeSocketEvents.JOIN_KARAOKE_ROOM]: (payload: KaraokeJoinRoomPayload) => void;
  [KaraokeSocketEvents.LEAVE_KARAOKE_ROOM]: (payload: { roomId: string }) => void;
  [KaraokeSocketEvents.KARAOKE_SELECT_SONG]: (payload: KaraokeSelectSongPayload) => void;
  [KaraokeSocketEvents.KARAOKE_START_SINGING]: (payload: KaraokeStartSingingPayload) => void;
  [KaraokeSocketEvents.KARAOKE_END_SESSION]: (payload: KaraokeEndSessionPayload) => void;
  [KaraokeSocketEvents.KARAOKE_SET_MIC]: (payload: KaraokeSetMicPayload) => void;
  [KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER]: (payload: KaraokeWebRTCOfferPayload) => void;
  [KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER]: (payload: KaraokeWebRTCAnswerPayload) => void;
  [KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE]: (payload: KaraokeWebRTCIceCandidatePayload) => void;
}
