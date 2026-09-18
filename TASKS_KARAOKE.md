# Karaoke MVP — task list

Legend: `[ ]` todo, `[x]` done, `[!]` blocked (see reason + BLOCKED.md)

## Inspection & docs
- [x] Inspect existing architecture (backend, mobile, realtime, auth, state, config)
- [x] Write PROJECT_KARAOKE.md
- [x] Write docs/karaoke-audio.md (sync strategy)
- [x] Final report (9-point summary requested in the task)

## Backend — schema
- [x] Prisma: KaraokeRoom, KaraokeMember models + enums
- [x] Migration created and applied locally

## Backend — REST
- [x] karaokeSessionAuth middleware
- [x] karaokeRoomService (create/join/get/select-song/end)
- [x] routes/karaoke.ts wired into index.ts

## Backend — realtime signaling
- [x] packages/shared: karaoke types + socket event contracts
- [x] socket/karaoke.ts: join/leave, start/stop singing, mic toggle, end session
- [x] socket/karaoke.ts: WebRTC offer/answer/ICE relay (singer <-> each listener)
- [x] disconnect cleanup (singer leaves -> end room; listener leaves -> remove + notify)
- [x] Verified via curl (REST) + scripted 2-client socket.io test (signaling) — all passed

## Mobile — plumbing
- [x] Install react-native-webrtc + config plugin (@config-plugins/react-native-webrtc)
- [x] Install expo-audio (mic permission API), expo-clipboard/react-native-qrcode-svg (reused
      from earlier session for invite dialog patterns, not karaoke-specific)
- [x] karaokeApi.ts (REST client)
- [x] karaokeSession.ts (AsyncStorage, mirrors session.ts)
- [x] useKaraokeRoomSocket.ts (room state sync, mirrors useRoomSocket)
- [x] useKaraokeWebRTC.ts (peer connections, mic capture, signaling)
- [x] Fixed upstream react-native-webrtc@124.0.8 packaging bug (missing
      lib/typescript/vendor/event-target-shim types) via a postinstall script — see
      apps/mobile/scripts/fix-webrtc-types.js. Full typecheck clean.

## Mobile — UI
- [x] app/karaoke/index.tsx (create/join)
- [x] app/karaoke/[code].tsx (room screen, singer vs listener views)
- [x] Connection-state UI (connecting/connected/reconnecting/mic unavailable/failed/ended)
- [x] Mic permission flow via expo-audio (request on use, not on startup; explain; handle denial)
- [x] Entry point from Home screen

## Verification
- [x] Full monorepo typecheck/build (shared, server, web, mobile) — clean
- [x] Scripted 2-client signaling test (offer/answer/ICE relay correctness, no real audio needed)
      — all checks passed
- [x] Code review pass — found and fixed a real bug (useKaraokeWebRTC's members list was sourced
      from a stale one-time REST snapshot instead of the live socket-updated list; see commit
      b690be8 for the full writeup)
- [x] EAS Android build **finished successfully** — installable APK:
      https://expo.dev/artifacts/eas/zRKnpv3xnJP_kivFrjKtu-8smBy_IumCSoCRFiR8Vf4.apk
      (build id `6a541620-86f6-42ca-a377-9ee634ed4bc5`, configured against the production
      backend). Ready for the user to install and run Scenario B.
- [x] Attempted EAS iOS build to confirm exactly where it blocks (Apple credentials, needs the
      user's own interactive login — see BLOCKED.md)
- [ ] Real WebRTC audio between two devices — genuinely cannot be observed by the agent in this
      environment (no Expo Go support, no expo-web fallback either — see BLOCKED.md). Needs the
      user to install the EAS build on a real device.
- [x] Document manual test steps for Scenarios A-E (see the final report / this file's "test
      plan" — everything is written and ready for the user to run once a device build exists)

## Web port (2026-09-18)
- [x] apps/web: karaokeApi/karaokeSession/iceServers lib files, socket.ts widened
- [x] apps/web: useKaraokeRoomSocket, useKaraokeWebRTC (browser-native RTCPeerConnection, no
      library needed), useKaraokePlayback hooks
- [x] apps/web: /karaoke (create/join) and /karaoke/[code] (room) pages, home page entry link
- [x] Full monorepo typecheck clean (`npx tsc --noEmit` in apps/web)
- [x] Verified end-to-end in two browser tabs: create room, real YouTube metadata fetch,
      Start Singing (WAITING→SINGING), listener join + live member-count sync, mic-permission-
      denial handling, End Session → listener sees "session has ended" + redirected
- [!] Real two-way mic audio on web — this dev environment's browser tool sandboxes
      `getUserMedia` outright (confirmed via an explicit tool notice), so it can't be exercised
      here; needs a real desktop/mobile browser. No install/build step required to test this,
      unlike mobile — just open the page in two browser tabs or two devices.

## Known blockers (see BLOCKED.md for detail)
- [!] react-native-webrtc cannot run in Expo Go — needs a custom dev client (in progress via EAS)
- [!] iOS dev client build needs either local Xcode (already blocked, see BLOCKED.md) or the
      user's own Apple ID in an interactive EAS credentials flow
- [!] Real device audio/latency/sync validation (Scenarios B-E below) needs the user's own
      phones — cannot be performed by the agent

## Test plan (for the user, once a device build exists — see "exact steps to test" in the final report)

**Scenario A — one phone, singer only**: create a room, select a song (paste a YouTube URL),
tap "Start Singing", turn the mic on. Expect: backing track plays, mic toggles without crashing,
no listener-side anything to check yet.

**Scenario B — two phones, singer + one listener**: Phone A creates a room and becomes singer;
Phone B joins with the room code as a listener. Singer selects a song, starts singing, turns mic
on. Expect: listener hears the backing track (their own local YouTube playback) roughly in sync
with the singer's, *and* hears the singer's live voice via WebRTC. This is the core scenario the
whole feature exists to prove — everything else is secondary to this working.

**Scenario C — three phones, singer + two listeners**: same as B with a second listener joining
before or after the singer starts. Expect: both listeners independently connect (one
`RTCPeerConnection` each, from the singer) and both hear the singer.

**Scenario D — network changes**: while connected, switch a listener's phone from wifi to mobile
data (and back), briefly toggle airplane mode, then let it settle. Expect: the socket layer
reconnects on its own (`useKaraokeRoomSocket`'s `AppState`-triggered reconnect plus socket.io's
own reconnection) and re-syncs room state; the WebRTC peer connection's `connectionState` should
show `disconnected` then either recover or need the listener to leave/rejoin if it lands in
`failed` (no automatic ICE restart is implemented for MVP — see docs/karaoke-audio.md's known
limitations).

**Scenario E — room lifecycle**: create → join (as listener) → singer starts singing → singer
ends session. Expect: listener sees "This karaoke session has ended" and is returned to the
karaoke home screen; the singer's local peer connections/mic are torn down
(`webrtc.teardown()`); rejoining the same room code afterward should correctly report "not
found"-equivalent (room status ENDED) rather than letting anyone back in.

## 2026-09-19 — real-usage improvements (user tested on real devices, reported 5 issues)
- [x] Tighter backing-track/voice sync for karaoke specifically (1.5s/0.6s vs the listening
      room's 5s/1.5s) — web + mobile
- [x] Noise suppression + echo cancellation + auto gain on mic capture — web + mobile
- [x] Higher-quality voice encoding (128kbps via RTCRtpSender.setParameters) — web + mobile
- [x] Song queue: KaraokeQueueItem model + migration, add/remove/advance service functions,
      REST endpoints, "Song list"/"Up Next" UI — web + mobile, verified end-to-end on web
      (auto-promote-when-empty, append-when-playing, play-next, remove all confirmed working)
- [x] Listener visibility panel (avatar + name, was just a count before) — web + mobile,
      verified end-to-end on web (real-time member sync confirmed across two tabs)
- [!] Real two-device audio quality/latency verification for the above — still gated on the
      same real-device requirement as the original MVP (mobile needs a build; web needs a real
      browser, not this dev tool's sandboxed one — see BLOCKED.md)
