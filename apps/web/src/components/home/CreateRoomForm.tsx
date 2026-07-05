"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Music } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createRoom, getErrorMessage } from "@/lib/api";
import { getStoredDisplayName, setRoomSession, storeDisplayName } from "@/lib/session";

export function CreateRoomForm() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [displayName, setDisplayName] = useState(getStoredDisplayName());

  const mutation = useMutation({
    mutationFn: () => createRoom({ roomName: roomName.trim(), displayName: displayName.trim() }),
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
          <Music className="h-5 w-5 text-primary" />
          Create a room
        </CardTitle>
        <CardDescription>Start a new listening room and invite your friends.</CardDescription>
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
            <Label htmlFor="create-room-name">Room name</Label>
            <Input
              id="create-room-name"
              placeholder="Friday night vibes"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-display-name">Your name</Label>
            <Input
              id="create-display-name"
              placeholder="Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={30}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending} className="mt-2">
            {mutation.isPending ? "Creating..." : "Create room"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
