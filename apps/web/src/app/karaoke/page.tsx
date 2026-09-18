"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Mic2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createKaraokeRoom, joinKaraokeRoom } from "@/lib/karaokeApi";
import { getErrorMessage } from "@/lib/api";
import { getStoredDisplayName, storeDisplayName } from "@/lib/session";
import { setKaraokeRoomSession } from "@/lib/karaokeSession";

export default function KaraokeHomePage() {
  const router = useRouter();
  const [createName, setCreateName] = useState(getStoredDisplayName());
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(getStoredDisplayName());

  const createMutation = useMutation({
    mutationFn: () => createKaraokeRoom({ displayName: createName.trim() }),
    onSuccess: ({ room, member }) => {
      storeDisplayName(member.displayName);
      setKaraokeRoomSession(room.code, { memberId: member.id, displayName: member.displayName, role: member.role });
      router.push(`/karaoke/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinKaraokeRoom(joinCode.trim(), { displayName: joinName.trim() }),
    onSuccess: ({ room, member }) => {
      storeDisplayName(member.displayName);
      setKaraokeRoomSession(room.code, { memberId: member.id, displayName: member.displayName, role: member.role });
      router.push(`/karaoke/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Mic2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Karaoke</h1>
        <p className="max-w-md text-muted-foreground">
          One singer, live mic, everyone else listens in real time over the same backing track.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="h-5 w-5 text-primary" />
              Start a room
            </CardTitle>
            <CardDescription>You&apos;ll be the singer — pick a song and go live.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="karaoke-create-name">Your name</Label>
                <Input
                  id="karaoke-create-name"
                  placeholder="Alex"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  maxLength={30}
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="mt-2">
                {createMutation.isPending ? "Creating..." : "Start singing"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join a room</CardTitle>
            <CardDescription>Enter a room code to listen in.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                joinMutation.mutate();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="karaoke-join-code">Room code</Label>
                <Input
                  id="karaoke-join-code"
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  maxLength={10}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="karaoke-join-name">Your name</Label>
                <Input
                  id="karaoke-join-name"
                  placeholder="Ben"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  required
                  maxLength={30}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={joinMutation.isPending} className="mt-2">
                {joinMutation.isPending ? "Joining..." : "Join as listener"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
