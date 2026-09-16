import { useEffect, useReducer, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { KaraokeSocketEvents } from "@musicapp/shared";
import type {
  KaraokeMemberDTO,
  KaraokeRoomDTO,
  KaraokeWebRTCAnswerReceivedPayload,
  KaraokeWebRTCIceCandidateReceivedPayload,
  KaraokeWebRTCOfferReceivedPayload,
} from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

interface KaraokeRoomSocketState {
  room: KaraokeRoomDTO | null;
  connected: boolean;
  error: string | null;
  roomEnded: boolean;
}

type Action =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "room_state"; room: KaraokeRoomDTO }
  | { type: "members"; members: KaraokeMemberDTO[] }
  | { type: "error"; message: string }
  | { type: "room_ended" };

function reducer(state: KaraokeRoomSocketState, action: Action): KaraokeRoomSocketState {
  switch (action.type) {
    case "connected":
      return { ...state, connected: true, error: null };
    case "disconnected":
      return { ...state, connected: false };
    case "room_state":
      return { ...state, room: action.room, error: null };
    case "members":
      return state.room ? { ...state, room: { ...state.room, members: action.members } } : state;
    case "error":
      return { ...state, error: action.message };
    case "room_ended":
      return { ...state, roomEnded: true };
    default:
      return state;
  }
}

export interface KaraokeSignalingHandlers {
  onOffer: (payload: KaraokeWebRTCOfferReceivedPayload) => void;
  onAnswer: (payload: KaraokeWebRTCAnswerReceivedPayload) => void;
  onIceCandidate: (payload: KaraokeWebRTCIceCandidateReceivedPayload) => void;
  /** A member came online/joined — the singer side uses this to open a new peer connection. */
  onMemberJoined: (member: KaraokeMemberDTO) => void;
  onMemberLeft: (memberId: string) => void;
}

/**
 * Mirrors useRoomSocket.ts's shape (reducer-based room state sync + reconnect-on-foreground)
 * but for the karaoke room. WebRTC signaling events are NOT folded into the reducer's state —
 * they're handed off live to `signaling` callbacks instead, since they drive imperative
 * RTCPeerConnection calls (useKaraokeWebRTC.ts), not React state.
 */
export function useKaraokeRoomSocket(roomId: string | null, memberId: string | null, signaling: KaraokeSignalingHandlers) {
  const [state, dispatch] = useReducer(reducer, {
    room: null,
    connected: false,
    error: null,
    roomEnded: false,
  });
  const joined = useRef(false);
  const signalingRef = useRef(signaling);
  signalingRef.current = signaling;

  useEffect(() => {
    if (!roomId || !memberId) return;

    const socket = getSocket();

    const join = () => {
      dispatch({ type: "connected" });
      socket.emit(KaraokeSocketEvents.JOIN_KARAOKE_ROOM, { roomId, memberId });
      joined.current = true;
    };

    const onDisconnect = () => {
      dispatch({ type: "disconnected" });
      joined.current = false;
    };

    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);

    socket.on(KaraokeSocketEvents.KARAOKE_ROOM_STATE, ({ room }) => dispatch({ type: "room_state", room }));
    socket.on(KaraokeSocketEvents.KARAOKE_MEMBER_JOINED, ({ member, members }) => {
      dispatch({ type: "members", members });
      if (member.id !== memberId) signalingRef.current.onMemberJoined(member);
    });
    socket.on(KaraokeSocketEvents.KARAOKE_MEMBER_LEFT, ({ memberId: leftId, members }) => {
      dispatch({ type: "members", members });
      signalingRef.current.onMemberLeft(leftId);
    });
    socket.on(KaraokeSocketEvents.KARAOKE_ROOM_ENDED, () => dispatch({ type: "room_ended" }));
    socket.on(KaraokeSocketEvents.KARAOKE_ERROR, ({ message }) => dispatch({ type: "error", message }));

    socket.on(KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER_RECEIVED, (payload) => signalingRef.current.onOffer(payload));
    socket.on(KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER_RECEIVED, (payload) => signalingRef.current.onAnswer(payload));
    socket.on(KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE_RECEIVED, (payload) => signalingRef.current.onIceCandidate(payload));

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === "active" && !socket.connected) socket.connect();
    };
    const appStateSub = AppState.addEventListener("change", onAppStateChange);

    if (socket.connected) join();
    else socket.connect();

    return () => {
      appStateSub.remove();
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
      socket.off(KaraokeSocketEvents.KARAOKE_ROOM_STATE);
      socket.off(KaraokeSocketEvents.KARAOKE_MEMBER_JOINED);
      socket.off(KaraokeSocketEvents.KARAOKE_MEMBER_LEFT);
      socket.off(KaraokeSocketEvents.KARAOKE_ROOM_ENDED);
      socket.off(KaraokeSocketEvents.KARAOKE_ERROR);
      socket.off(KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER_RECEIVED);
      socket.off(KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER_RECEIVED);
      socket.off(KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE_RECEIVED);
      socket.emit(KaraokeSocketEvents.LEAVE_KARAOKE_ROOM, { roomId });
      socket.disconnect();
      joined.current = false;
    };
  }, [roomId, memberId]);

  return state;
}
