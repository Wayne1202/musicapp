# Karaoke MVP — task list

Legend: `[ ]` todo, `[x]` done, `[!]` blocked (see reason + BLOCKED.md)

## Inspection & docs
- [x] Inspect existing architecture (backend, mobile, realtime, auth, state, config)
- [x] Write PROJECT_KARAOKE.md
- [ ] Write docs/karaoke-audio.md (sync strategy)
- [ ] Final report (9-point summary requested in the task)

## Backend — schema
- [ ] Prisma: KaraokeRoom, KaraokeMember models + enums
- [ ] Migration created and applied locally

## Backend — REST
- [ ] karaokeSessionAuth middleware
- [ ] karaokeRoomService (create/join/get/select-song/end)
- [ ] routes/karaoke.ts wired into index.ts

## Backend — realtime signaling
- [ ] packages/shared: karaoke types + socket event contracts
- [ ] socket/karaoke.ts: join/leave, start/stop singing, mic toggle, end session
- [ ] socket/karaoke.ts: WebRTC offer/answer/ICE relay (singer <-> each listener)
- [ ] disconnect cleanup (singer leaves -> end room; listener leaves -> remove + notify)

## Mobile — plumbing
- [ ] Install react-native-webrtc + config plugin, rebuild dev client requirement documented
- [ ] karaokeApi.ts (REST client)
- [ ] karaokeSession.ts (AsyncStorage, mirrors session.ts)
- [ ] useKaraokeRoomSocket.ts (room state sync, mirrors useRoomSocket)
- [ ] useKaraokeWebRTC.ts (peer connections, mic capture, signaling)

## Mobile — UI
- [ ] app/karaoke/index.tsx (create/join)
- [ ] app/karaoke/[code].tsx (room screen, singer vs listener views)
- [ ] Connection-state UI (connecting/connected/reconnecting/mic unavailable/failed/ended)
- [ ] Mic permission flow (request on use, not on startup; explain; handle denial)
- [ ] Entry point from Home screen

## Verification
- [ ] Full monorepo typecheck/build
- [ ] Scripted 2-client signaling test (offer/answer/ICE relay correctness, no real audio needed)
- [ ] Attempt EAS Android build (installable APK, no local Xcode/Android Studio needed)
- [ ] Document manual test steps for Scenarios A-E (real device audio — needs user's phones)

## Known blockers (see BLOCKED.md for detail)
- [!] react-native-webrtc cannot run in Expo Go — needs a custom dev client
- [!] iOS dev client build needs either local Xcode (already blocked, see BLOCKED.md) or the
      user's own Apple ID in an interactive EAS credentials flow
