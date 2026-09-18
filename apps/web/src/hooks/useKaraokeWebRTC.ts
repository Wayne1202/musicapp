"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Default WebRTC audio (Opus) bitrate is tuned for speech-call use cases (~32-64kbps), which can
// sound compressed/artifacty for singing's wider dynamic range. Bump it via the standard
// RTCRtpSender API (not SDP munging) right after the track is added — best-effort, since not
// every browser's encoder honors every value.
const SINGER_AUDIO_BITRATE_BPS = 128_000;

function applyHighQualityAudioEncoding(sender: RTCRtpSender) {
  const params = sender.getParameters();
  params.encodings = params.encodings?.length ? params.encodings : [{}];
  params.encodings[0].maxBitrate = SINGER_AUDIO_BITRATE_BPS;
  sender.setParameters(params).catch(() => {
    // Best-effort — some browsers/codecs reject certain encoding params. The call still works
    // at whatever bitrate the encoder defaults to.
  });
}

/**
 * Browser-native counterpart to apps/mobile/src/hooks/useKaraokeWebRTC.ts — same signaling
 * contract, same star topology (singer holds one RTCPeerConnection per listener), same
 * lazy-peer-creation / mute-without-teardown design (see docs/karaoke-audio.md). The only real
 * difference from the mobile version: browsers don't auto-route an incoming remote audio track
 * to the speakers the way react-native-webrtc does natively, so this hook also exposes
 * `remoteStream` (listener-side only — there's exactly one peer, the singer) for the room UI to
 * bind to a hidden `<audio>` element. RTCPeerConnection/RTCSessionDescription/RTCIceCandidate/
 * MediaStream are all browser globals here — no library import needed, unlike react-native-webrtc.
 */
export function useKaraokeWebRTC(params: { roomId: string | null; memberId: string | null; role: "SINGER" | "LISTENER" | null }) {
  const { roomId, memberId, role } = params;

  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const [micOn, setMicOnState] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [peerStates, setPeerStates] = useState<Record<string, KaraokePeerConnectionState>>({});
  // Listener-side only: the singer's incoming audio, for the room UI to attach to an <audio> tag.
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

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

      // Listener side only: the singer's audio track arrives here — browsers don't auto-play a
      // remote track the way react-native-webrtc does, so we surface it for the UI to bind.
      pc.addEventListener("track", (event) => {
        setRemoteStream(event.streams[0] ?? null);
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
    setRemoteStream((prev) => (prev ? null : prev));
  }, []);

  // --- Singer side: initiate an offer to a given listener. ---
  const connectToListener = useCallback(
    async (listenerId: string) => {
      const entry = getOrCreatePeer(listenerId);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          const sender = entry.pc.addTrack(track, localStreamRef.current!);
          applyHighQualityAudioEncoding(sender);
        });
      }
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      emitOffer(listenerId, offer.sdp ?? "");
    },
    [getOrCreatePeer, emitOffer],
  );

  // Last-known member list. Kept fresh only by the public ensureConnections() below (called by
  // the room screen whenever the live member list changes) so startMic can retry against it
  // once the mic stream exists, without the room screen needing to call in a second time.
  const lastMembersRef = useRef<KaraokeMemberDTO[]>([]);

  const connectToOnlineListeners = useCallback(() => {
    if (role !== "SINGER" || !localStreamRef.current) return;
    for (const member of lastMembersRef.current) {
      if (member.id === memberId || member.role !== "LISTENER") continue;
      if (peersRef.current.has(member.id)) continue;
      connectToListener(member.id).catch(() => updatePeerState(member.id, "failed"));
    }
  }, [role, memberId, connectToListener, updatePeerState]);

  /** Public: connects to any online listener that doesn't have a peer connection yet. Call
   *  whenever the live member list changes (retroactive case — a brand new join while already
   *  connected is handled immediately via onMemberJoined below instead, this covers "the mic
   *  turns on after listeners already joined"). */
  const ensureConnections = useCallback(
    (currentMembers: KaraokeMemberDTO[]) => {
      lastMembersRef.current = currentMembers;
      connectToOnlineListeners();
    },
    [connectToOnlineListeners],
  );

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
      emitAnswer(fromMemberId, answer.sdp ?? "");
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
      if (!localStreamRef.current) {
        // Standard, built-in browser audio processing — not something custom, quality varies by
        // device/browser but this is a real, free improvement over raw mic input.
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
          video: false,
        });
      } else {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }
      setMicPermissionDenied(false);
      setMicOnState(true);
      getSocket().emit(KaraokeSocketEvents.KARAOKE_SET_MIC, { roomId, micOn: true });
      connectToOnlineListeners();
    } catch {
      setMicPermissionDenied(true);
    }
  }, [role, roomId, connectToOnlineListeners]);

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
    setRemoteStream(null);
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
    ensureConnections,
    micOn,
    micPermissionDenied,
    startMic,
    stopMic,
    teardown,
    listenerConnectionState,
    peerStates,
    remoteStream,
  };
}
