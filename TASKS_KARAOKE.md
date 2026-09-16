# Karaoke MVP — task list

Legend: `[ ]` todo, `[x]` done, `[!]` blocked (see reason + BLOCKED.md)

## Inspection & docs
- [x] Inspect existing architecture (backend, mobile, realtime, auth, state, config)
- [x] Write PROJECT_KARAOKE.md
- [ ] Write docs/karaoke-audio.md (sync strategy)
- [ ] Final report (9-point summary requested in the task)

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
- [ ] Full monorepo typecheck/build
- [ ] Scripted 2-client signaling test (offer/answer/ICE relay correctness, no real audio needed)
- [ ] Attempt EAS Android build (installable APK, no local Xcode/Android Studio needed)
- [ ] Document manual test steps for Scenarios A-E (real device audio — needs user's phones)

## Known blockers (see BLOCKED.md for detail)
- [!] react-native-webrtc cannot run in Expo Go — needs a custom dev client
- [!] iOS dev client build needs either local Xcode (already blocked, see BLOCKED.md) or the
      user's own Apple ID in an interactive EAS credentials flow
