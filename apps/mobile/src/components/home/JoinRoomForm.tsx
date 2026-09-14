import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { getErrorMessage, joinRoom } from "@/lib/api";
import { getStoredDisplayName, setRoomSession, storeDisplayName } from "@/lib/session";
import { toast } from "@/lib/toast";

export function JoinRoomForm() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    getStoredDisplayName().then(setDisplayName);
  }, []);

  const mutation = useMutation({
    mutationFn: () => joinRoom(roomCode.trim(), { displayName: displayName.trim() }),
    onSuccess: async ({ room, session }) => {
      await storeDisplayName(session.displayName);
      await setRoomSession(room.code, { sessionId: session.id, displayName: session.displayName });
      router.push(`/room/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const canSubmit = roomCode.trim().length > 0 && displayName.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>👥 Join a room</CardTitle>
        <CardDescription>Enter a room code shared by a friend.</CardDescription>
      </CardHeader>
      <CardContent>
        <TextField
          label="Room code"
          placeholder="ABC123"
          value={roomCode}
          onChangeText={(text) => setRoomCode(text.toUpperCase())}
          maxLength={10}
          autoCapitalize="characters"
        />
        <TextField label="Your name" placeholder="Ben" value={displayName} onChangeText={setDisplayName} maxLength={30} />
        <Button onPress={() => mutation.mutate()} variant="secondary" disabled={!canSubmit} loading={mutation.isPending}>
          {mutation.isPending ? "Joining..." : "Join room"}
        </Button>
      </CardContent>
    </Card>
  );
}
