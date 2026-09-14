import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { createRoom, getErrorMessage } from "@/lib/api";
import { getStoredDisplayName, setRoomSession, storeDisplayName } from "@/lib/session";
import { toast } from "@/lib/toast";

export function CreateRoomForm() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    getStoredDisplayName().then(setDisplayName);
  }, []);

  const mutation = useMutation({
    mutationFn: () => createRoom({ roomName: roomName.trim(), displayName: displayName.trim() }),
    onSuccess: async ({ room, session }) => {
      await storeDisplayName(session.displayName);
      await setRoomSession(room.code, { sessionId: session.id, displayName: session.displayName });
      router.push(`/room/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const canSubmit = roomName.trim().length > 0 && displayName.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>🎵 Create a room</CardTitle>
        <CardDescription>Start a new listening room and invite your friends.</CardDescription>
      </CardHeader>
      <CardContent>
        <TextField
          label="Room name"
          placeholder="Friday night vibes"
          value={roomName}
          onChangeText={setRoomName}
          maxLength={60}
        />
        <TextField label="Your name" placeholder="Alex" value={displayName} onChangeText={setDisplayName} maxLength={30} />
        <Button onPress={() => mutation.mutate()} disabled={!canSubmit} loading={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create room"}
        </Button>
      </CardContent>
    </Card>
  );
}
