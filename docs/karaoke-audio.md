# Karaoke: audio & synchronization strategy

How the karaoke room keeps a singer's live mic and the YouTube backing track feeling
synchronized to everyone in the room. See `PROJECT_KARAOKE.md` for the broader architecture and
`BLOCKED.md` for why the WebRTC audio path specifically hasn't been run/observed directly by the
agent that built this (Expo Go can't load `react-native-webrtc`, and the usual `expo start --web`
fallback used elsewhere in this project doesn't work for it either).

## The two audio paths are architecturally separate

This is the central design decision, so it's worth stating plainly: **the backing track and the
singer's voice never travel together, and never touch the same transport.**

```
Backing track (YouTube):                  Singer's voice:
  Singer's device  ──┐                      Singer's mic
  Listener's device ─┼─ each independently    │
  Listener's device ─┘   loads + plays the    ▼
                         SAME YouTube video  WebRTC (RTCPeerConnection,
                         locally, synced      one per listener)
                         via a server           │
                         timestamp               ▼
                                              Listener's device speaker
```

- **Backing track**: every device (singer's included) independently loads the same YouTube
  video via `react-native-youtube-iframe` and plays it locally. This is the *exact* sync
  strategy the listening room already uses (`packages/shared/src/playback.ts`'s
  `projectPlaybackPosition`), reused verbatim — see "Reuse, not a copy" below. No audio crosses
  the network for this path at all; only a `{videoId, isPlaying, timestamp, updatedAt}` state
  object does, over the existing Socket.IO connection.
- **Singer's voice**: captured from the mic, sent live over WebRTC directly to each listener's
  device (a star topology — the singer holds one `RTCPeerConnection` per listener; listeners
  never connect to each other or send audio at all, since they have nothing to send).

A listener's device therefore produces the full karaoke mix — backing track + singer's voice —
by playing both locally and letting the OS mix them, the same way any phone mixes multiple
concurrent audio sources.

**Why this split, not one combined stream**: the task this was built against explicitly
diagrams the realtime transport as carrying only `MIC`, not the backing track, and separately
calls for reusing "the existing song playback implementation." Piping *only* the voice over
WebRTC is also just less data and less to get wrong — the backing track already has a proven,
working sync mechanism; there was no reason to reinvent it as a mixed WebRTC stream.

## Reuse, not a copy

`KaraokeRoomDTO` (`packages/shared/src/karaoke.ts`) is deliberately shaped identically to
`PlaybackStateDTO` for its playback fields (`currentVideoId`, `currentTitle`, `currentThumbnail`,
`currentDuration`, `currentTimestamp`, `isPlaying`, `updatedAt`). `projectPlaybackPosition()`
(`packages/shared/src/playback.ts`) was narrowed to accept the minimal structural shape it
actually reads, rather than the full `PlaybackStateDTO` — so it runs unmodified against a
`KaraokeRoomDTO` too. `apps/mobile/src/hooks/useKaraokePlayback.ts` is a smaller sibling of
`usePlayerController.ts` (the listening room's player hook): same drift-correction loop, same
tap-to-unlock gate, same defensive `safeSeekTo` wrapper (both now share
`apps/mobile/src/lib/youtubeSync.ts` instead of each having their own copy) — trimmed down since
karaoke has no play/pause/seek/skip transport controls for MVP, only the singer's one-shot
"Start Singing" action.

## Clock source

No dedicated clock sync (NTP-style offset estimation) between devices. Every client trusts its
own device clock and the server's `updatedAt` timestamp (an ISO string, set by
`Date.now()`-equivalent on the server at the moment playback started). `projectPlaybackPosition`
computes `currentTimestamp + (Date.now() - updatedAt) / 1000` locally on each device — so this
implicitly assumes every device's clock is reasonably close to correct, which is a safe
assumption for phones (they sync to network time by default) but is a real, if minor, source of
drift between two listeners on devices with slightly different clock skew. Documented as a known
limitation below, not solved for MVP.

## Playback start timestamp

Set server-side, in `karaokeRoomService.startKaraokeSinging()`: `currentTimestamp: 0` plus
Prisma's `updatedAt` auto-field becomes the timeline origin. Every device — singer and every
listener, whenever they joined or reconnected — computes "where the backing track should be
right now" from that same origin, rather than each device independently starting its own local
timer the moment it happens to load the video. This is what the task spec's "avoid restarting
playback independently on every listener" / "maintain a room/session playback timeline"
requirement is asking for, and it's the same mechanism (not a new one) the listening room already
proved out.

## Audio transport

- **Backing track**: no network transport — local YouTube playback per device (see above).
- **Singer's voice**: WebRTC (`react-native-webrtc`), audio-only `MediaStreamTrack`, one
  `RTCPeerConnection` per listener. Signaling (SDP offer/answer, ICE candidates) is relayed
  through the existing Socket.IO server (`apps/server/src/socket/karaoke.ts`) — addressed by
  `memberId`, routed via an in-memory `roomId -> memberId -> socketId` map that's pure routing,
  never touches SDP/ICE payload content, and is ephemeral (same tier as every other per-room
  socket-layer state in this codebase — see `PROJECT_KARAOKE.md`). STUN-only for MVP (no TURN
  relay) — see "known limitations."
- Peer connections are created lazily: only once the singer's local mic stream actually exists.
  This means the singer never needs to renegotiate an existing connection to add a track later —
  a listener who joins before the singer's mic is on just has no connection yet; once the mic
  turns on, connections are opened (with the track already attached from the start) for every
  currently-online listener in one pass (`ensureConnectionsForListeners` in
  `useKaraokeWebRTC.ts`).
- Muting ("Mic OFF") does **not** tear down the connection — it sets
  `track.enabled = false` on the local track. The connection (and its ICE negotiation) stays
  alive; the listener just receives silence. This avoids renegotiation entirely for the common
  mute/unmute case; only "End Session" does a real teardown (`RTCPeerConnection.close()` on every
  peer, `track.stop()` on the local stream).

## Expected latency

Not measured on real hardware in this environment (see `BLOCKED.md` — the agent that built this
cannot run `react-native-webrtc` in any tool available to it: not Expo Go, not the `expo start
--web` fallback used for everything else in this project). Expected order of magnitude, based on
how WebRTC audio behaves generally on a local wifi network with STUN-only NAT traversal: **roughly
100-300ms** end-to-end (capture → encode → network → decode → playback) for two devices on the
same LAN, potentially higher (or failing entirely) across restrictive NATs without a TURN relay.
This needs to be actually measured once a real device build exists — see "known limitations" and
`TASKS_KARAOKE.md`'s test plan (Scenario B).

## Jitter buffering

Handled entirely inside `react-native-webrtc`'s native WebRTC engine (the underlying
Chromium/Jitsi WebRTC implementation) — the standard adaptive jitter buffer built into any WebRTC
audio receiver, not something this app configures or implements itself. No custom buffering was
added on top; there was no reason to (WebRTC's own is the right layer for this, and reimplementing
it would be exactly the kind of "production-scale infrastructure" the task spec says to skip).

## Known limitations

- **No TURN server** — STUN-only (`apps/mobile/src/lib/iceServers.ts`, free public Google STUN
  servers). Works for most home wifi / mobile carrier NATs; will fail to connect across symmetric
  NATs or restrictive networks (some corporate/campus wifi) where a TURN relay would be required.
  Running a TURN server is real infrastructure to operate — explicitly out of scope per the task
  spec ("do not build production-scale infrastructure").
- **No clock-offset correction between devices** — see "Clock source" above. Two listeners on
  devices with different clock drift will project slightly different "now" positions for the
  backing track. In practice this is usually well under a second and not perceptible, but it's
  not actively corrected for.
- **Feedback risk for the singer** — if the singer plays the backing track through their phone's
  speaker (rather than headphones), their own mic will likely pick up that audio and send it back
  to listeners along with their voice. This is a standard live-audio consideration (same as any
  karaoke/streaming setup), not something this app can fix in software; the natural mitigation
  (headphones) is a UX/usage note, not a code change, and is worth surfacing in the room UI later
  (not done for this MVP pass — see "what to implement next" in the final report).
- **No renegotiation path for a singer's mid-session `getUserMedia` failure/track loss** — if the
  local audio track dies for some OS-level reason after being added to peer connections, there's
  no automatic recovery beyond what "Mic OFF" then "Mic ON" (which reuses the existing stream/
  track, or re-acquires if it's gone — see `startMic` in `useKaraokeWebRTC.ts`) already covers.
- **Aggregate connection-state UI is per-listener only** — a listener sees their own single
  connection's state (connecting/connected/failed); the singer's UI doesn't yet break down
  *which* listeners are connected vs. failed individually, only exposes the raw per-peer state
  map (`webrtc.peerStates`) that a future UI pass could surface.

## 2026-09-19 improvements (real user feedback after live testing)

After the karaoke MVP was actually tested on real devices, the user reported audible backing-
track/voice latency, wanted a song queue instead of one-song-at-a-time, wanted listeners visible
by name (not just a count, ahead of a possible future tipping feature), and asked for noise
suppression and a smoother singer voice. What changed:

- **Tighter backing-track sync, karaoke-only**: karaoke's drift-check interval dropped from 5s to
  1.5s and the correction threshold from 1.5s to 0.6s (`apps/web/src/hooks/useKaraokePlayback.ts`;
  `apps/mobile/src/lib/youtubeSync.ts`'s new `KARAOKE_DRIFT_*` constants, used only by
  `apps/mobile/src/hooks/useKaraokePlayback.ts` — the listening room's own constants/behavior are
  untouched). This meaningfully tightens the gap between each listener's local backing-track
  position and the singer's near-real-time WebRTC voice, but can't eliminate it — each listener's
  own video buffering still varies independently. See "Known limitations" below.
- **Noise suppression + echo cancellation + auto gain**: turned on via standard `getUserMedia`
  audio constraints (`noiseSuppression`, `echoCancellation`, `autoGainControl`) in both
  `useKaraokeWebRTC.ts` hooks. Built-in browser/WebRTC feature, not custom DSP.
- **Higher-quality voice encoding**: the singer's outgoing audio bitrate is explicitly raised to
  128kbps via the standard `RTCRtpSender.setParameters({encodings: [{maxBitrate}]})` API (not SDP
  munging) right after `addTrack`, in both hooks. Default WebRTC audio bitrate is tuned for
  speech calls and can sound compressed for singing's wider dynamic range.
- **Song queue**: new `KaraokeQueueItem` table + `addKaraokeQueueItem`/`removeKaraokeQueueItem`/
  `advanceKaraokeQueue` in `karaokeRoomService.ts`, REST endpoints under `/api/karaoke-rooms/
  :roomId/queue`, and a "Song list"/"Up Next" UI on both platforms. Adding a song when nothing is
  currently loaded promotes it immediately (no reason to leave it "queued" behind an empty
  now-playing slot); otherwise it queues behind whatever's current. "Play Next" pops the earliest
  queued song into the current slot — if the room is already SINGING it plays immediately, if
  still WAITING it just loads (mirrors `selectKaraokeSong`'s original single-song behavior for
  that case).
- **Listener visibility**: a "Listeners" panel (avatar + name, same style as the listening room's
  Online Users) replaces the old plain listener *count* on both platforms. No tip button yet —
  that's explicitly deferred (see the memory note on holding monetization work until asked); this
  pass only makes listener identity visible so a future tip action has somewhere to attach.

## How this can improve later without a rewrite

The signaling layer, the peer-connection lifecycle, and the backing-track sync are three
independently swappable pieces:
- Swapping STUN-only for STUN+TURN is a one-line change to `iceServers.ts` plus provisioning a
  TURN server (e.g. coturn, or a managed provider) — nothing else in the architecture changes.
- Tighter sync (e.g. server-authoritative periodic re-broadcast of the timestamp instead of a
  purely client-computed projection, or NTP-style clock offset estimation per device) can be
  layered onto the existing `projectPlaybackPosition` call sites without changing the transport.
- A future move from a star topology to an SFU (for many-listener scale, well beyond this MVP's
  target) would only change `useKaraokeWebRTC.ts`'s connection-management internals — the
  signaling *event contract* (offer/answer/ICE, addressed by member) and the REST/room-lifecycle
  layer around it wouldn't need to change.
