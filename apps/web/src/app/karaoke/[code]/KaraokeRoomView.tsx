"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { KaraokeSocketEvents, isValidYouTubeUrl } from "@musicapp/shared";
import type { KaraokeRoomDTO } from "@musicapp/shared";
import { getErrorMessage } from "@/lib/api";
import {
  addKaraokeQueueItem,
  advanceKaraokeQueue,
  getKaraokeRoom,
  joinKaraokeRoom,
  removeKaraokeQueueItem,
} from "@/lib/karaokeApi";
import { getStoredDisplayName, storeDisplayName } from "@/lib/session";
import {
  clearKaraokeRoomSession,
  getKaraokeRoomSession,
  setKaraokeRoomSession,
  type KaraokeRoomSession,
} from "@/lib/karaokeSession";
import { useKaraokeRoomSocket } from "@/hooks/useKaraokeRoomSocket";
import { useKaraokeWebRTC } from "@/hooks/useKaraokeWebRTC";
import { useKaraokePlayback } from "@/hooks/useKaraokePlayback";
import { getSocket } from "@/lib/socket";
import { KaraokePlayerEngine } from "@/components/karaoke/KaraokePlayerEngine";
import { KaraokeListeners } from "@/components/karaoke/KaraokeListeners";
import { KaraokeQueue } from "@/components/karaoke/KaraokeQueue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KaraokeRoomView({ code }: { code: string }) {
  const router = useRouter();
  const [session, setSession] = useState<KaraokeRoomSession | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    setSession(getKaraokeRoomSession(code));
    setCheckedStorage(true);
  }, [code]);

  const roomQuery = useQuery({
    queryKey: ["karaoke-room", code],
    queryFn: () => getKaraokeRoom(code),
    retry: false,
  });

  const roomId = roomQuery.data?.room.id ?? null;
  const role = session?.role ?? null;

  const webrtc = useKaraokeWebRTC({ roomId, memberId: session?.memberId ?? null, role });
  const live = useKaraokeRoomSocket(roomId, session?.memberId ?? null, webrtc.signalingHandlers);

  // Retroactively connect to any already-online listeners whenever the *live* member list
  // changes — mirrors apps/mobile's KaraokeRoomScreen exactly (same circular-dependency
  // rationale: `live` depends on webrtc's signaling handlers, so it can't be a plain prop into
  // useKaraokeWebRTC itself).
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
    return <Centered text="This karaoke session has ended." onDone={() => router.push("/karaoke")} />;
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
  const playback = useKaraokePlayback(room);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSinger = room.singerMemberId === session.memberId;
  const singer = room.members.find((m) => m.id === room.singerMemberId);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = webrtc.remoteStream;
  }, [webrtc.remoteStream]);

  const startAudio = () => {
    playback.handleStart();
    audioRef.current?.play().catch(() => {});
  };

  const leaveRoom = () => {
    webrtc.teardown();
    clearKaraokeRoomSession(code);
    router.push("/karaoke");
  };

  const endSession = () => {
    webrtc.teardown();
    getSocket().emit(KaraokeSocketEvents.KARAOKE_END_SESSION, { roomId: room.id });
    clearKaraokeRoomSession(code);
    router.push("/karaoke");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6 sm:py-8">
      <KaraokePlayerEngine onReady={playback.onPlayerReady} />
      {/* Listener-side only: the singer's live mic audio, relayed over WebRTC (see
          useKaraokeWebRTC.ts) — browsers require an explicit srcObject + a user gesture to
          actually produce sound, unlike react-native-webrtc's auto-routed remote tracks. */}
      <audio ref={audioRef} autoPlay playsInline hidden />

      <div className="flex items-center justify-between border-b border-border pb-4">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="pulse-dot-red h-2 w-2 rounded-full bg-red-500" />
          Live Karaoke — {code}
        </h1>
        <ConnectionBadge connected={connected} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="font-semibold">🎤 Singer: {singer?.displayName ?? "…"}</p>

          {playback.hasSong ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {room.currentThumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={room.currentThumbnail} alt="" className="h-16 w-16 rounded-md object-cover" />
                )}
                <p className="text-sm font-medium">{room.currentTitle}</p>
              </div>
              {!playback.hasInteracted && (
                <Button onClick={startAudio} className="mt-1">
                  ▶ Tap to start audio
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No song selected yet.</p>
          )}

          {!isSinger && <p className="text-sm text-muted-foreground">🎙 Mic: {room.micOn ? "ON" : "OFF"}</p>}
        </CardContent>
      </Card>

      {!isSinger && <ListenerConnectionState state={webrtc.listenerConnectionState} />}

      {!isSinger && room.queue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Up next</CardTitle>
          </CardHeader>
          <CardContent>
            <KaraokeQueue queue={room.queue} />
          </CardContent>
        </Card>
      )}

      <KaraokeListeners members={room.members} />

      {isSinger ? (
        <SingerControls room={room} webrtc={webrtc} onEndSession={endSession} />
      ) : (
        <Button variant="destructive" onClick={leaveRoom}>
          Leave Room
        </Button>
      )}
    </main>
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Song list</CardTitle>
          <CardDescription>
            Paste YouTube links to line up songs — the first one loads automatically, the rest wait here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Button type="submit" disabled={!isValidYouTubeUrl(url.trim()) || addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </form>

          <KaraokeQueue queue={room.queue} onRemove={(itemId) => removeMutation.mutate(itemId)} removingId={removingId} />

          {room.queue.length > 0 && (
            <Button variant="secondary" onClick={() => nextMutation.mutate()} disabled={nextMutation.isPending}>
              {nextMutation.isPending ? "Loading…" : "▶ Play Next"}
            </Button>
          )}
        </CardContent>
      </Card>

      {webrtc.micPermissionDenied && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          🎙 Microphone unavailable — check your browser&apos;s microphone permission for this site.
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={startSinging} disabled={!room.currentVideoId || room.status === "SINGING"} className="flex-1">
          {room.status === "SINGING" ? "Singing…" : "Start Singing"}
        </Button>
        <Button
          variant={webrtc.micOn ? "default" : "secondary"}
          onClick={() => (webrtc.micOn ? webrtc.stopMic() : webrtc.startMic())}
          disabled={room.status !== "SINGING"}
          className="flex-1"
        >
          🎙 Mic {webrtc.micOn ? "ON" : "OFF"}
        </Button>
      </div>
      <Button variant="destructive" onClick={onEndSession}>
        End Session
      </Button>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${connected ? "pulse-dot bg-primary" : "bg-muted-foreground"}`} />
      {connected ? "Connected" : "Connecting…"}
    </div>
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
  return <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{label}</div>;
}

function JoinPrompt({ code, onJoined }: { code: string; onJoined: (session: KaraokeRoomSession) => void }) {
  const [displayName, setDisplayName] = useState(getStoredDisplayName());

  const mutation = useMutation({
    mutationFn: () => joinKaraokeRoom(code, { displayName: displayName.trim() }),
    onSuccess: ({ member }) => {
      storeDisplayName(member.displayName);
      const roomSession: KaraokeRoomSession = { memberId: member.id, displayName: member.displayName, role: member.role };
      setKaraokeRoomSession(code, roomSession);
      onJoined(roomSession);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join karaoke room {code}</CardTitle>
          <CardDescription>Enter a display name to listen in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="karaoke-room-join-name">Your name</Label>
              <Input
                id="karaoke-room-join-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={30}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Joining..." : "Join as listener"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Centered({ text, loading, onDone }: { text?: string; loading?: boolean; onDone?: () => void }) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground">{text}</p>
      {onDone && (
        <Button variant="secondary" onClick={onDone}>
          Back to Karaoke
        </Button>
      )}
    </div>
  );
}
