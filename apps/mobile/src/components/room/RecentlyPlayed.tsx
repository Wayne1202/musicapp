import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { colors, radius, spacing } from "@/theme";
import { formatDuration } from "@/lib/utils";
import { getRecentlyPlayed } from "@/lib/api";

export function RecentlyPlayed({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["recently-played", roomId],
    queryFn: () => getRecentlyPlayed(roomId, 10),
    enabled: open,
  });

  const items = query.data?.items ?? [];

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>🕐</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Last 10 played</Text>

            {query.isLoading ? (
              <ActivityIndicator color={colors.mutedForeground} style={{ paddingVertical: spacing.lg }} />
            ) : items.length === 0 ? (
              <Text style={styles.emptyText}>Nothing played yet.</Text>
            ) : (
              <ScrollView style={styles.list}>
                {items.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
                    <View style={styles.info}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {item.addedByName ? `Added by ${item.addedByName}` : "Unknown"}
                      </Text>
                    </View>
                    <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
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
    height: 40,
    width: 40,
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
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  duration: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
});
