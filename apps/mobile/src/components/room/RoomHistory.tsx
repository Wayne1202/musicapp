import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { colors, radius, spacing } from "@/theme";
import { formatClockTime } from "@/lib/utils";
import { getRoomHistory } from "@/lib/api";

export function RoomHistory({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["room-history", roomId],
    queryFn: () => getRoomHistory(roomId),
    enabled: open,
  });

  const entries = query.data?.entries ?? [];

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>📜</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Room history</Text>

            {query.isLoading ? (
              <ActivityIndicator color={colors.mutedForeground} style={{ paddingVertical: spacing.lg }} />
            ) : entries.length === 0 ? (
              <Text style={styles.emptyText}>Nothing has happened here yet.</Text>
            ) : (
              <ScrollView style={styles.list}>
                {entries.map((entry) => (
                  <View key={entry.kind === "event" ? entry.event.id : entry.song.id} style={styles.row}>
                    {entry.kind === "song" ? (
                      <>
                        <Image source={{ uri: entry.song.thumbnail }} style={styles.thumb} />
                        <View style={styles.info}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {entry.song.title}
                          </Text>
                          <Text style={styles.rowSubtitle} numberOfLines={1}>
                            {entry.song.addedByName ? `Added by ${entry.song.addedByName}` : "Played"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.eventIcon}>{entry.event.type === "HOST_TRANSFERRED" ? "👥" : "🎵"}</Text>
                        <Text style={styles.eventSummary} numberOfLines={1}>
                          {entry.event.summary}
                        </Text>
                      </>
                    )}
                    <Text style={styles.time}>{formatClockTime(entry.at)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 32,
    width: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerText: {
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#000000A0",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thumb: {
    height: 36,
    width: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.foreground,
    fontSize: 13,
  },
  rowSubtitle: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  eventIcon: {
    fontSize: 14,
  },
  eventSummary: {
    flex: 1,
    minWidth: 0,
    color: colors.mutedForeground,
    fontSize: 13,
  },
  time: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
});
