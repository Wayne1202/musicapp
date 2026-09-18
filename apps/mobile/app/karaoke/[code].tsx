import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubeIframe from "react-native-youtube-iframe";
import { KaraokeSocketEvents, isValidYouTubeUrl } from "@musicapp/shared";
import type { KaraokeMemberDTO, KaraokeQueueItemDTO, KaraokeRoomDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { avatarColor } from "@/lib/avatarColor";
import { addKaraokeQueueItem, advanceKaraokeQueue, getKaraokeRoom, removeKaraokeQueueItem } from "@/lib/karaokeApi";
import { getErrorMessage } from "@/lib/api";
import { getStoredDisplayName, storeDisplayName } from "@/lib/session";
import {
  clearKaraokeRoomSession,
  getKaraokeRoomSession,
  setKaraokeRoomSession,
  type KaraokeRoomSession,
} from "@/lib/karaokeSession";
import { joinKaraokeRoom } from "@/lib/karaokeApi";
import { useKaraokeRoomSocket } from "@/hooks/useKaraokeRoomSocket";
import { useKaraokeWebRTC } from "@/hooks/useKaraokeWebRTC";
import { useKaraokePlayback } from "@/hooks/useKaraokePlayback";
import { getSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";

export default function KaraokeRoomScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = (rawCode ?? "").toUpperCase();
  const router = useRouter();

  const [session, setSession] = useState<KaraokeRoomSession | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    setCheckedStorage(false);
    getKaraokeRoomSession(code).then((s) => {
      setSession(s);
      setCheckedStorage(true);
    });
  }, [code]);

  const roomQuery = useQuery({
    queryKey: ["karaoke-room", code],
    queryFn: () => getKaraokeRoom(code),
    retry: false,
    enabled: code.length > 0,
  });

  const roomId = roomQuery.data?.room.id ?? null;
  const role = session?.role ?? null;

  const webrtc = useKaraokeWebRTC({ roomId, memberId: session?.memberId ?? null, role });
  const live = useKaraokeRoomSocket(roomId, session?.memberId ?? null, webrtc.signalingHandlers);

  // Retroactively connect to any already-online listeners whenever the *live* member list
  // changes (e.g. the singer's mic turns on after several listeners already joined — a brand
  // new join is separately handled immediately via webrtc.signalingHandlers.onMemberJoined).
  // Deliberately not a `members` prop on useKaraokeWebRTC itself: that would need `live`
  // (declared after webrtc, and dependent on webrtc's own signaling handlers) available before
  // webrtc is constructed — a real circular dependency, not just an ordering inconvenience.
  const members = live.room?.members ?? roomQuery.data?.room.members ?? [];
  useEffect(() => {
    webrtc.ensureConnections(members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  useEffect(() => {
    if (live.error) toast.error(live.error);
  }, [live.error]);

  useEffect(() => {
    if (live.roomEnded) {
      webrtc.teardown();
      clearKaraokeRoomSession(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.roomEnded]);

  if (!checkedStorage || roomQuery.isLoading) {
    return <Centered loading />;
  }

  if (roomQuery.isError || !roomQuery.data) {
    return <Centered text={`Karaoke room "${code}" was not found.`} />;
  }

  if (!session) {
    return <JoinPrompt code={code} onJoined={setSession} />;
  }

  const room = live.room ?? roomQuery.data.room;

  if (live.roomEnded || room.status === "ENDED") {
    return <Centered text="This karaoke session has ended." onDone={() => router.replace("/karaoke")} />;
  }

  return <RoomShell room={room} session={session} connected={live.connected} webrtc={webrtc} code={code} router={router} />;
}

function RoomShell({
  room,
  session,
  connected,
  webrtc,
  code,
  router,
}: {
  room: KaraokeRoomDTO;
  session: KaraokeRoomSession;
  connected: boolean;
  webrtc: ReturnType<typeof useKaraokeWebRTC>;
  code: string;
  router: ReturnType<typeof useRouter>;
}) {
  const insets = useSafeAreaInsets();
  const playback = useKaraokePlayback(room);
  const isSinger = room.singerMemberId === session.memberId;
  const singer = room.members.find((m) => m.id === room.singerMemberId);

  const leaveRoom = () => {
    webrtc.teardown();
    clearKaraokeRoomSession(code);
    router.replace("/karaoke");
  };

  const endSession = () => {
    webrtc.teardown();
    getSocket().emit(KaraokeSocketEvents.KARAOKE_END_SESSION, { roomId: room.id });
    clearKaraokeRoomSession(code);
    router.replace("/karaoke");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🔴 LIVE KARAOKE</Text>
        <ConnectionBadge connected={connected} />
      </View>

      <Card>
        <CardContent>
          <Text style={styles.singerLine}>🎤 Singer: {singer?.displayName ?? "…"}</Text>

          {playback.hasSong ? (
            <View style={styles.playerWrap}>
              <YoutubeIframe
                ref={playback.playerRef}
                height={200}
                videoId={playback.videoId ?? undefined}
                play={playback.shouldPlay}
                onReady={playback.onReady}
                onChangeState={playback.onChangeState}
                initialPlayerParams={{ controls: false, rel: false, preventFullScreen: true }}
                webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
              />
              {!playback.hasInteracted && (
                <Pressable style={styles.unlockOverlay} onPress={playback.handleStart}>
                  <Text style={styles.unlockText}>▶ Tap to start audio</Text>
                </Pressable>
              )}
              <Text style={styles.songTitle} numberOfLines={2}>
                {room.currentTitle}
              </Text>
            </View>
          ) : (
            <Text style={styles.mutedText}>No song selected yet.</Text>
          )}

          {!isSinger && <Text style={styles.mutedText}>🎙 Mic: {room.micOn ? "ON" : "OFF"}</Text>}
        </CardContent>
      </Card>

      {!isSinger && <ListenerConnectionState state={webrtc.listenerConnectionState} />}

      {!isSinger && room.queue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Up next</CardTitle>
          </CardHeader>
          <CardContent>
            <KaraokeQueueList queue={room.queue} />
          </CardContent>
        </Card>
      )}

      <KaraokeListeners members={room.members} />

      {isSinger ? (
        <SingerControls room={room} webrtc={webrtc} onEndSession={endSession} />
      ) : (
        <Button variant="destructive" onPress={leaveRoom}>
          Leave Room
        </Button>
      )}
    </ScrollView>
  );
}

function KaraokeListeners({ members }: { members: KaraokeMemberDTO[] }) {
  const listeners = members.filter((m) => m.role === "LISTENER");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listeners ({listeners.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {listeners.length === 0 ? (
          <Text style={styles.mutedText}>No one&apos;s listening yet — share the room code.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {listeners.map((listener) => (
              <View key={listener.id} style={styles.listenerRow}>
                <Avatar name={listener.displayName} color={avatarColor(listener.id)} size={28} />
                <Text style={styles.listenerName} numberOfLines={1}>
                  {listener.displayName}
                </Text>
                <View
                  style={[styles.dot, { backgroundColor: listener.isOnline ? colors.primary : colors.mutedForeground }]}
                />
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function KaraokeQueueList({
  queue,
  onRemove,
  removingId,
}: {
  queue: KaraokeQueueItemDTO[];
  onRemove?: (itemId: string) => void;
  removingId?: string | null;
}) {
  if (queue.length === 0) {
    return <Text style={styles.mutedText}>Nothing queued yet.</Text>;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {queue.map((item, index) => (
        <View key={item.id} style={styles.queueRow}>
          <Text style={styles.metaText}>{index + 1}</Text>
          <Text style={styles.queueTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {onRemove && (
            <Button variant="ghost" onPress={() => onRemove(item.id)} disabled={removingId === item.id} style={{ paddingHorizontal: spacing.sm }}>
              ✕
            </Button>
          )}
        </View>
      ))}
    </View>
  );
}

function SingerControls({
  room,
  webrtc,
  onEndSession,
}: {
  room: KaraokeRoomDTO;
  webrtc: ReturnType<typeof useKaraokeWebRTC>;
  onEndSession: () => void;
}) {
  const [url, setUrl] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () => addKaraokeQueueItem(room.id, room.singerMemberId!, { url: url.trim() }),
    onSuccess: () => setUrl(""),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeKaraokeQueueItem(room.id, room.singerMemberId!, itemId),
    onMutate: (itemId: string) => setRemovingId(itemId),
    onSettled: () => setRemovingId(null),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const nextMutation = useMutation({
    mutationFn: () => advanceKaraokeQueue(room.id, room.singerMemberId!),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const startSinging = () => {
    getSocket().emit(KaraokeSocketEvents.KARAOKE_START_SINGING, { roomId: room.id });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <CardHeader>
          <CardTitle>Song list</CardTitle>
          <CardDescription>Paste YouTube links to line up songs — the first one loads automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              style={styles.input}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={colors.mutedForeground}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              onPress={() => addMutation.mutate()}
              disabled={!isValidYouTubeUrl(url.trim()) || addMutation.isPending}
              loading={addMutation.isPending}
              style={{ paddingHorizontal: spacing.md }}
            >
              Add
            </Button>
          </View>

          <KaraokeQueueList queue={room.queue} onRemove={(id) => removeMutation.mutate(id)} removingId={removingId} />

          {room.queue.length > 0 && (
            <Button variant="secondary" onPress={() => nextMutation.mutate()} loading={nextMutation.isPending}>
              ▶ Play Next
            </Button>
          )}
        </CardContent>
      </Card>

      {webrtc.micPermissionDenied && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>🎙 Microphone unavailable — check your permission settings for this app.</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button onPress={startSinging} disabled={!room.currentVideoId || room.status === "SINGING"} style={{ flex: 1 }}>
          {room.status === "SINGING" ? "Singing…" : "Start Singing"}
        </Button>
        <Button
          variant={webrtc.micOn ? "primary" : "secondary"}
          onPress={() => (webrtc.micOn ? webrtc.stopMic() : webrtc.startMic())}
          disabled={room.status !== "SINGING"}
          style={{ flex: 1 }}
        >
          🎙 Mic {webrtc.micOn ? "ON" : "OFF"}
        </Button>
      </View>
      <Button variant="destructive" onPress={onEndSession}>
        End Session
      </Button>
    </View>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <View style={styles.connectionBadge}>
      <View style={[styles.dot, { backgroundColor: connected ? colors.primary : colors.mutedForeground }]} />
      <Text style={styles.metaText}>{connected ? "Connected" : "Connecting…"}</Text>
    </View>
  );
}

function ListenerConnectionState({ state }: { state: string }) {
  const label =
    state === "connected"
      ? "🔊 Connected — you should hear the singer"
      : state === "failed"
        ? "⚠️ Listener connection failed — try leaving and rejoining"
        : state === "disconnected"
          ? "🔄 Reconnecting…"
          : "⏳ Connecting to singer's mic…";
  return (
    <View style={styles.warningBanner}>
      <Text style={styles.warningText}>{label}</Text>
    </View>
  );
}

function JoinPrompt({ code, onJoined }: { code: string; onJoined: (session: KaraokeRoomSession) => void }) {
  const [displayName, setDisplayName] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getStoredDisplayName().then(setDisplayName);
  }, []);

  const mutation = useMutation({
    mutationFn: () => joinKaraokeRoom(code, { displayName: displayName.trim() }),
    onSuccess: async ({ member }) => {
      await storeDisplayName(member.displayName);
      const roomSession: KaraokeRoomSession = { memberId: member.id, displayName: member.displayName, role: member.role };
      await setKaraokeRoomSession(code, roomSession);
      onJoined(roomSession);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <View style={[styles.centered, { paddingTop: insets.top }]}>
      <View style={{ width: "100%", maxWidth: 360, paddingHorizontal: spacing.lg }}>
        <Card>
          <CardHeader>
            <CardTitle>Join karaoke room {code}</CardTitle>
            <CardDescription>Enter a display name to listen in.</CardDescription>
          </CardHeader>
          <CardContent>
            <TextField label="Your name" value={displayName} onChangeText={setDisplayName} maxLength={30} autoFocus />
            <Button onPress={() => mutation.mutate()} disabled={displayName.trim().length === 0} loading={mutation.isPending}>
              {mutation.isPending ? "Joining..." : "Join as listener"}
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}

function Centered({ text, loading, onDone }: { text?: string; loading?: boolean; onDone?: () => void }) {
  return (
    <View style={styles.centered}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={styles.metaText}>{text}</Text>
          {onDone && (
            <Button onPress={onDone} variant="secondary">
              Back to Karaoke
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
  connectionBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  listenerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  listenerName: { flex: 1, color: colors.foreground, fontSize: 14 },
  queueRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  queueTitle: { flex: 1, color: colors.foreground, fontSize: 13 },
  dot: { height: 8, width: 8, borderRadius: 4 },
  singerLine: { color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 2 },
  metaText: { color: colors.mutedForeground, fontSize: 13 },
  mutedText: { color: colors.mutedForeground, fontSize: 13, marginTop: spacing.sm },
  playerWrap: { marginTop: spacing.md, gap: spacing.xs },
  unlockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    borderRadius: radius.md,
    backgroundColor: "#000000A0",
    alignItems: "center",
    justifyContent: "center",
  },
  unlockText: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
  songTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.foreground,
    fontSize: 14,
  },
  warningBanner: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { color: colors.foreground, fontSize: 13 },
});
