"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, getRoom, joinRoom } from "@/lib/api";
import { getRoomSession, getStoredDisplayName, setRoomSession, storeDisplayName } from "@/lib/session";
import type { RoomSession } from "@/lib/session";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { RoomHeader } from "@/components/room/RoomHeader";
import { AddSongForm } from "@/components/room/AddSongForm";
import { NowPlaying } from "@/components/room/NowPlaying";
import { Queue } from "@/components/room/Queue";
import { OnlineUsers } from "@/components/room/OnlineUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RoomView({ code }: { code: string }) {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    setSession(getRoomSession(code));
    setCheckedStorage(true);
  }, [code]);

  const roomQuery = useQuery({
    queryKey: ["room", code],
    queryFn: () => getRoom(code),
    retry: false,
  });

  const roomId = roomQuery.data?.room.id ?? null;
  const live = useRoomSocket(session ? roomId : null, session?.sessionId ?? null);

  if (!checkedStorage || roomQuery.isLoading) {
    return <RoomSkeleton />;
  }

  if (roomQuery.isError || !roomQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-muted-foreground">Room &quot;{code}&quot; was not found.</p>
      </div>
    );
  }

  if (!session) {
    return <JoinPrompt code={code} roomName={roomQuery.data.room.name} onJoined={setSession} />;
  }

  const room = live.room ?? roomQuery.data.room;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6 sm:py-8">
      <RoomHeader
        roomName={room.name}
        roomCode={room.code}
        onlineCount={room.onlineUsers.length}
        connected={live.connected}
      />

      <AddSongForm roomId={room.id} sessionId={session.sessionId} />

      <NowPlaying roomId={room.id} playbackState={room.playbackState} />

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Queue queue={room.queue} roomId={room.id} sessionId={session.sessionId} repeatQueue={room.repeatQueue} />
        </div>
        <div>
          <OnlineUsers users={room.onlineUsers} currentSessionId={session.sessionId} />
        </div>
      </div>
    </main>
  );
}

function JoinPrompt({
  code,
  roomName,
  onJoined,
}: {
  code: string;
  roomName: string;
  onJoined: (session: RoomSession) => void;
}) {
  const [displayName, setDisplayName] = useState(getStoredDisplayName());

  const mutation = useMutation({
    mutationFn: () => joinRoom(code, { displayName: displayName.trim() }),
    onSuccess: ({ session }) => {
      storeDisplayName(session.displayName);
      const roomSession = { sessionId: session.id, displayName: session.displayName };
      setRoomSession(code, roomSession);
      onJoined(roomSession);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join &quot;{roomName}&quot;</CardTitle>
          <CardDescription>Enter a display name to join this room.</CardDescription>
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
              <Label htmlFor="join-name">Your name</Label>
              <Input
                id="join-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={30}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Joining..." : "Join room"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <Skeleton className="h-[60px] w-full rounded-lg" />

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Skeleton className="h-40 w-40 shrink-0 rounded-lg sm:h-32 sm:w-32" />
          <div className="flex w-full flex-col gap-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:col-span-2">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </div>
    </main>
  );
}
