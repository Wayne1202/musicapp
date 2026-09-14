import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PresenceStateDTO, UserSessionDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { avatarColor } from "@/lib/avatarColor";
import { Avatar } from "@/components/ui/Avatar";

const ACTIVITY_LABEL: Record<string, string> = {
  adding_song: "adding a song…",
  editing_queue: "editing the queue…",
};

interface OnlineUsersProps {
  users: UserSessionDTO[];
  currentSessionId: string | null;
  hostSessionId: string | null;
  presence?: Record<string, PresenceStateDTO>;
  onMakeHost?: (sessionId: string) => void;
}

export function OnlineUsers({ users, currentSessionId, hostSessionId, presence = {}, onMakeHost }: OnlineUsersProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Online users <Text style={styles.count}>({users.length})</Text>
      </Text>

      <View style={styles.list}>
        {users.map((user) => {
          const isHostUser = user.id === hostSessionId;
          const away = presence[user.id]?.status === "away";
          const activity = presence[user.id]?.activity;
          const activityLabel = activity ? ACTIVITY_LABEL[activity] : undefined;

          return (
            <View key={user.id} style={styles.row}>
              <Avatar name={user.displayName} color={avatarColor(user.id)} size={32} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {isHostUser ? "👑 " : ""}
                  {user.displayName}
                  {user.id === currentSessionId ? " (you)" : ""}
                </Text>
                {activityLabel ? (
                  <Text style={styles.activity}>{activityLabel}</Text>
                ) : away ? (
                  <Text style={styles.activity}>away</Text>
                ) : null}
              </View>
              {onMakeHost && !isHostUser && (
                <Pressable onPress={() => onMakeHost(user.id)} style={styles.makeHostButton}>
                  <Text style={styles.makeHostText}>Make host</Text>
                </Pressable>
              )}
              <View style={[styles.dot, { backgroundColor: away ? colors.mutedForeground : colors.primary }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  count: {
    color: colors.mutedForeground,
    fontWeight: "400",
    fontSize: 12,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.foreground,
    fontSize: 13,
  },
  activity: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 1,
  },
  makeHostButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  makeHostText: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
});
