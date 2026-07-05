"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage, joinRoom } from "@/lib/api";
import { getStoredDisplayName, setRoomSession, storeDisplayName } from "@/lib/session";

export function JoinRoomForm() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState(getStoredDisplayName());

  const mutation = useMutation({
    mutationFn: () => joinRoom(roomCode.trim(), { displayName: displayName.trim() }),
    onSuccess: ({ room, session }) => {
      storeDisplayName(session.displayName);
      setRoomSession(room.code, { sessionId: session.id, displayName: session.displayName });
      router.push(`/room/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Join a room
        </CardTitle>
        <CardDescription>Enter a room code shared by a friend.</CardDescription>
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
            <Label htmlFor="join-room-code">Room code</Label>
            <Input
              id="join-room-code"
              placeholder="ABC123"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              required
              maxLength={10}
              className="uppercase tracking-widest"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="join-display-name">Your name</Label>
            <Input
              id="join-display-name"
              placeholder="Ben"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={30}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={mutation.isPending} className="mt-2">
            {mutation.isPending ? "Joining..." : "Join room"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
