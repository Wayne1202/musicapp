import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices } from "react-native-webrtc";
import { requestRecordingPermissionsAsync, getRecordingPermissionsAsync } from "expo-audio";
import { KaraokeSocketEvents } from "@musicapp/shared";
import type {
  IceCandidateInit,
  KaraokeMemberDTO,
  KaraokeWebRTCAnswerReceivedPayload,
  KaraokeWebRTCIceCandidateReceivedPayload,
  KaraokeWebRTCOfferReceivedPayload,
} from "@musicapp/shared";
import { getSocket } from "@/lib/socket";
import { KARAOKE_ICE_SERVERS } from "@/lib/iceServers";
import type { KaraokeSignalingHandlers } from "@/hooks/useKaraokeRoomSocket";

export type KaraokePeerConnectionState = "connecting" | "connected" | "disconnected" | "failed" | "closed" | "new";

interface PeerEntry {
  pc: RTCPeerConnection;
  pendingCandidates: IceCandidateInit[];
  remoteDescriptionSet: boolean;
}

/**
 * Owns every RTCPeerConnection for this device (a star topology centered on the singer — see
 * docs/karaoke-audio.md): the singer holds one connection per listener, a listener holds exactly
 * one connection (to the singer). Peer connections are created lazily, only once a local mic
 * stream exists — this means the singer never needs to renegotiate an existing connection to add
 * a track later; a listener who joins before the singer's mic is on just waits until it is (see
 * ensureConnectionsForListeners below).
 */
export function useKaraokeWebRTC(params: {
  roomId: string | null;
  memberId: string | null;
  role: "SINGER" | "LISTENER" | null;
  members: KaraokeMemberDTO[];
}) {
  const { roomId, memberId, role, members } = params;

  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<import("react-native-webrtc").MediaStream | null>(null);

  const [micOn, setMicOnState] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [peerStates, setPeerStates] = useState<Record<string, KaraokePeerConnectionState>>({});

  const updatePeerState = useCallback((peerId: string, state: KaraokePeerConnectionState) => {
    setPeerStates((prev) => ({ ...prev, [peerId]: state }));
  }, []);

  const emitIce = useCallback(
    (toMemberId: string, candidate: IceCandidateInit) => {
      if (!roomId) return;
      getSocket().emit(KaraokeSocketEvents.KARAOKE_WEBRTC_ICE_CANDIDATE, { roomId, toMemberId, candidate });
    },
    [roomId],
  );
  const emitOffer = useCallback(
    (toMemberId: string, sdp: string) => {
      if (!roomId) return;
      getSocket().emit(KaraokeSocketEvents.KARAOKE_WEBRTC_OFFER, { roomId, toMemberId, sdp });
    },
    [roomId],
  );
  const emitAnswer = useCallback(
    (toMemberId: string, sdp: string) => {
      if (!roomId) return;
      getSocket().emit(KaraokeSocketEvents.KARAOKE_WEBRTC_ANSWER, { roomId, toMemberId, sdp });
    },
    [roomId],
  );

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: KARAOKE_ICE_SERVERS });

      pc.addEventListener("icecandidate", (event) => {
        if (!event.candidate) return;
        emitIce(peerId, {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      });

      pc.addEventListener("connectionstatechange", () => {
        updatePeerState(peerId, pc.connectionState as KaraokePeerConnectionState);
      });

      return pc;
    },
    [emitIce, updatePeerState],
  );

  const getOrCreatePeer = useCallback(
    (peerId: string): PeerEntry => {
      let entry = peersRef.current.get(peerId);
      if (!entry) {
        entry = { pc: createPeerConnection(peerId), pendingCandidates: [], remoteDescriptionSet: false };
        peersRef.current.set(peerId, entry);
        updatePeerState(peerId, "connecting");
      }
      return entry;
    },
    [createPeerConnection, updatePeerState],
  );

  const flushPendingCandidates = useCallback(async (entry: PeerEntry) => {
    const candidates = entry.pendingCandidates;
    entry.pendingCandidates = [];
    for (const candidate of candidates) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore a stray/late candidate
      }
    }
  }, []);

  const closePeer = useCallback((peerId: string) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.pc.close();
    peersRef.current.delete(peerId);
    setPeerStates((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  // --- Singer side: initiate an offer to a given listener. ---
  const connectToListener = useCallback(
    async (listenerId: string) => {
      const entry = getOrCreatePeer(listenerId);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          entry.pc.addTrack(track, localStreamRef.current!);
        });
      }
      const offer = await entry.pc.createOffer({});
      await entry.pc.setLocalDescription(offer);
      emitOffer(listenerId, offer.sdp);
    },
    [getOrCreatePeer, emitOffer],
  );

  const ensureConnectionsForListeners = useCallback(() => {
    if (role !== "SINGER" || !localStreamRef.current) return;
    for (const member of members) {
      if (member.id === memberId || member.role !== "LISTENER") continue;
      if (peersRef.current.has(member.id)) continue;
      connectToListener(member.id).catch(() => updatePeerState(member.id, "failed"));
    }
  }, [role, members, memberId, connectToListener, updatePeerState]);

  useEffect(() => {
    ensureConnectionsForListeners();
  }, [ensureConnectionsForListeners]);

  // --- Signaling handlers, passed into useKaraokeRoomSocket ---

  const onOffer = useCallback(
    async ({ fromMemberId, sdp }: KaraokeWebRTCOfferReceivedPayload) => {
      // Listener side: the singer always initiates. recvonly — listeners never send audio.
      const entry = getOrCreatePeer(fromMemberId);
      await entry.pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
      entry.remoteDescriptionSet = true;
      await flushPendingCandidates(entry);
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      emitAnswer(fromMemberId, answer.sdp);
    },
    [getOrCreatePeer, flushPendingCandidates, emitAnswer],
  );

  const onAnswer = useCallback(
    async ({ fromMemberId, sdp }: KaraokeWebRTCAnswerReceivedPayload) => {
      const entry = peersRef.current.get(fromMemberId);
      if (!entry) return;
      await entry.pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
      entry.remoteDescriptionSet = true;
      await flushPendingCandidates(entry);
    },
    [flushPendingCandidates],
  );

  const onIceCandidate = useCallback(
    async ({ fromMemberId, candidate }: KaraokeWebRTCIceCandidateReceivedPayload) => {
      const entry = getOrCreatePeer(fromMemberId);
      if (!entry.remoteDescriptionSet) {
        entry.pendingCandidates.push(candidate);
        return;
      }
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    },
    [getOrCreatePeer],
  );

  const onMemberJoined = useCallback(
    (member: KaraokeMemberDTO) => {
      if (role === "SINGER" && member.role === "LISTENER" && localStreamRef.current) {
        connectToListener(member.id).catch(() => updatePeerState(member.id, "failed"));
      }
    },
    [role, connectToListener, updatePeerState],
  );

  const onMemberLeft = useCallback((leftId: string) => closePeer(leftId), [closePeer]);

  const signalingHandlers: KaraokeSignalingHandlers = useMemo(
    () => ({ onOffer, onAnswer, onIceCandidate, onMemberJoined, onMemberLeft }),
    [onOffer, onAnswer, onIceCandidate, onMemberJoined, onMemberLeft],
  );

  // --- Mic control (singer only) ---

  const startMic = useCallback(async () => {
    if (role !== "SINGER" || !roomId) return;
    try {
      const current = await getRecordingPermissionsAsync();
      let granted = current.granted;
      if (!granted) {
        const result = await requestRecordingPermissionsAsync();
        granted = result.granted;
      }
      if (!granted) {
        setMicPermissionDenied(true);
        return;
      }
      setMicPermissionDenied(false);

      if (!localStreamRef.current) {
        localStreamRef.current = await mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }
      setMicOnState(true);
      getSocket().emit(KaraokeSocketEvents.KARAOKE_SET_MIC, { roomId, micOn: true });
      ensureConnectionsForListeners();
    } catch {
      setMicPermissionDenied(true);
    }
  }, [role, roomId, ensureConnectionsForListeners]);

  const stopMic = useCallback(() => {
    if (role !== "SINGER" || !roomId) return;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setMicOnState(false);
    getSocket().emit(KaraokeSocketEvents.KARAOKE_SET_MIC, { roomId, micOn: false });
  }, [role, roomId]);

  // --- Full teardown (leaving the room / ending the session / unmount) ---
  const teardown = useCallback(() => {
    for (const peerId of Array.from(peersRef.current.keys())) closePeer(peerId);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setMicOnState(false);
  }, [closePeer]);

  useEffect(() => {
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listener's single connection state — there's only ever one peer (the singer).
  const listenerConnectionState: KaraokePeerConnectionState | "idle" =
    role === "LISTENER" ? (Object.values(peerStates)[0] ?? "connecting") : "idle";

  return {
    signalingHandlers,
    micOn,
    micPermissionDenied,
    startMic,
    stopMic,
    teardown,
    listenerConnectionState,
    peerStates,
  };
}
