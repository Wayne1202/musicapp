import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatMessageDTO, PresenceStateDTO, RoomDTO, VoteSkipStateDTO } from "@musicapp/shared";
import { canSkipInstantly, SocketEvents } from "@musicapp/shared";
import { colors, spacing } from "@/theme";
import { getErrorMessage, getRoom, joinRoom } from "@/lib/api";
import { getRoomSession, getStoredDisplayName, setRoomSession, clearRoomSession, storeDisplayName } from "@/lib/session";
import type { RoomSession } from "@/lib/session";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { usePlayerController } from "@/hooks/usePlayerController";
import type { PlayerController } from "@/hooks/usePlayerController";
import { usePlaybackActions } from "@/hooks/usePlaybackActions";
import { getSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { NowPlaying } from "@/components/room/NowPlaying";
import { AddSongForm } from "@/components/room/AddSongForm";
import { Queue } from "@/components/room/Queue";
import { OnlineUsers } from "@/components/room/OnlineUsers";
import { ChatPanel } from "@/components/room/ChatPanel";
import { VoteSkipBanner } from "@/components/room/VoteSkipBanner";
import { ReactionLayer } from "@/components/room/ReactionLayer";

export default function RoomScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = (rawCode ?? "").toUpperCase();

  const [session, setSession] = useState<RoomSession | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    setCheckedStorage(false);
    getRoomSession(code).then((s) => {
      setSession(s);
      setCheckedStorage(true);
    });
  }, [code]);

  const roomQuery = useQuery({
    queryKey: ["room", code],
    queryFn: () => getRoom(code),
    retry: false,
    enabled: code.length > 0,
  });

  const roomId = roomQuery.data?.room.id ?? null;
  const live = useRoomSocket(session ? roomId : null, session?.sessionId ?? null);
  const playbackState = live.room?.playbackState ?? roomQuery.data?.room.playbackState ?? null;
  const controller = usePlayerController(roomId, playbackState);

  useEffect(() => {
    if (live.error) toast.error(live.error);
  }, [live.error]);

  if (!checkedStorage || roomQuery.isLoading) {
    return <CenteredMessage loading />;
  }

  if (roomQuery.isError || !roomQuery.data) {
    return <CenteredMessage text={`Room "${code}" was not found.`} />;
  }

  if (!session) {
    return <JoinPrompt code={code} roomName={roomQuery.data.room.name} onJoined={setSession} />;
  }

  const room = live.room ?? roomQuery.data.room;

  if (live.roomEnded || room.status === "ENDED") {
    clearRoomSession(code);
    return <CenteredMessage text={`This room has ended. The host closed "${room.name}".`} />;
  }

  return (
    <RoomShell
      room={room}
      session={session}
      connected={live.connected}
      presence={live.presence}
      messages={live.messages}
      vote={live.vote}
      controller={controller}
    />
  );
}

function RoomShell({
  room,
  session,
  connected,
  presence,
  messages,
  vote,
  controller,
}: {
  room: RoomDTO;
  session: RoomSession;
  connected: boolean;
  presence: Record<string, PresenceStateDTO>;
  messages: ChatMessageDTO[];
  vote: VoteSkipStateDTO | null;
  controller: PlayerController;
}) {
  const insets = useSafeAreaInsets();
  const isHost = room.hostSessionId === session.sessionId;
  const voteActions = usePlaybackActions(room.id);
  const handleMakeHost = (targetSessionId: string) => {
    getSocket().emit(SocketEvents.TRANSFER_HOST, { roomId: room.id, targetSessionId });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.roomName}>{room.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.code}>{room.code}</Text>
            <View style={[styles.dot, { backgroundColor: connected ? colors.primary : colors.mutedForeground }]} />
            <Text style={styles.metaText}>{connected ? "Connected" : "Connecting…"}</Text>
          </View>
        </View>
        <Text style={styles.metaText}>Online ({room.onlineUsers.length})</Text>
      </View>

      <AddSongForm roomId={room.id} sessionId={session.sessionId} settings={room.settings} hostSessionId={room.hostSessionId} />

      <NowPlaying playbackState={room.playbackState} controller={controller} />

      <ReactionLayer roomId={room.id} sessionId={session.sessionId} reactionsEnabled={room.settings.reactionsEnabled} />

      <VoteSkipBanner
        vote={vote}
        sessionId={session.sessionId}
        canSkipInstantly={canSkipInstantly({ hostSessionId: room.hostSessionId, ...room.settings }, session.sessionId)}
        hasSong={Boolean(room.playbackState?.currentVideoId)}
        onStartVote={voteActions.startVoteSkip}
        onCastVote={voteActions.castVoteSkip}
      />

      <Queue
        queue={room.queue}
        roomId={room.id}
        sessionId={session.sessionId}
        repeatQueue={room.repeatQueue}
        settings={room.settings}
        hostSessionId={room.hostSessionId}
        presence={presence}
      />

      <OnlineUsers
        users={room.onlineUsers}
        currentSessionId={session.sessionId}
        hostSessionId={room.hostSessionId}
        presence={presence}
        onMakeHost={isHost ? handleMakeHost : undefined}
      />

      <ChatPanel
        roomId={room.id}
        sessionId={session.sessionId}
        displayName={session.displayName}
        onlineUsers={room.onlineUsers}
        chatEnabled={room.settings.chatEnabled}
        presence={presence}
        liveMessages={messages}
      />
    </ScrollView>
  );
}

function JoinPrompt({ code, roomName, onJoined }: { code: string; roomName: string; onJoined: (session: RoomSession) => void }) {
  const [displayName, setDisplayName] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getStoredDisplayName().then(setDisplayName);
  }, []);

  const mutation = useMutation({
    mutationFn: () => joinRoom(code, { displayName: displayName.trim() }),
    onSuccess: async ({ session }) => {
      await storeDisplayName(session.displayName);
      const roomSession = { sessionId: session.id, displayName: session.displayName };
      await setRoomSession(code, roomSession);
      onJoined(roomSession);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <View style={[styles.centered, { paddingTop: insets.top }]}>
      <View style={{ width: "100%", maxWidth: 360, paddingHorizontal: spacing.lg }}>
        <Card>
          <CardHeader>
            <CardTitle>Join &quot;{roomName}&quot;</CardTitle>
            <CardDescription>Enter a display name to join this room.</CardDescription>
          </CardHeader>
          <CardContent>
            <TextField label="Your name" value={displayName} onChangeText={setDisplayName} maxLength={30} autoFocus />
            <Button onPress={() => mutation.mutate()} disabled={displayName.trim().length === 0} loading={mutation.isPending}>
              {mutation.isPending ? "Joining..." : "Join room"}
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}

function CenteredMessage({ text, loading }: { text?: string; loading?: boolean }) {
  return (
    <View style={styles.centered}>
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.metaText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roomName: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 4,
  },
  code: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  metaText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
});
