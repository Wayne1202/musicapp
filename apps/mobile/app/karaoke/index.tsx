import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { createKaraokeRoom, joinKaraokeRoom } from "@/lib/karaokeApi";
import { getErrorMessage } from "@/lib/api";
import { getStoredDisplayName, storeDisplayName } from "@/lib/session";
import { setKaraokeRoomSession } from "@/lib/karaokeSession";
import { toast } from "@/lib/toast";

export default function KaraokeHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    getStoredDisplayName().then(setDisplayName);
  }, []);

  const createMutation = useMutation({
    mutationFn: () => createKaraokeRoom({ displayName: displayName.trim() }),
    onSuccess: async ({ room, member }) => {
      await storeDisplayName(member.displayName);
      await setKaraokeRoomSession(room.code, { memberId: member.id, displayName: member.displayName, role: member.role });
      router.push(`/karaoke/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinKaraokeRoom(roomCode.trim(), { displayName: displayName.trim() }),
    onSuccess: async ({ room, member }) => {
      await storeDisplayName(member.displayName);
      await setKaraokeRoomSession(room.code, { memberId: member.id, displayName: member.displayName, role: member.role });
      router.push(`/karaoke/${room.code}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>🎤 Karaoke</Text>
        <Text style={styles.subtitle}>One singer, live mic, everyone else listens in real time.</Text>
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Start a room</CardTitle>
          <CardDescription>You'll be the singer — pick a song and go live.</CardDescription>
        </CardHeader>
        <CardContent>
          <TextField label="Your name" placeholder="Alex" value={displayName} onChangeText={setDisplayName} maxLength={30} />
          <Button
            onPress={() => createMutation.mutate()}
            disabled={displayName.trim().length === 0}
            loading={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Start singing"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join a room</CardTitle>
          <CardDescription>Enter a room code to listen in.</CardDescription>
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
          <Button
            variant="secondary"
            onPress={() => joinMutation.mutate()}
            disabled={roomCode.trim().length === 0 || displayName.trim().length === 0}
            loading={joinMutation.isPending}
          >
            {joinMutation.isPending ? "Joining..." : "Join as listener"}
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
});
