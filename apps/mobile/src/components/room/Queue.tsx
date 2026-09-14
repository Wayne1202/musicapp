import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { canEditQueue, canShuffleOrClear, isHost as checkIsHost, SocketEvents } from "@musicapp/shared";
import type { PresenceStateDTO, QueueItemDTO, RoomSettingsDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { formatDuration } from "@/lib/utils";
import { useQueueActions } from "@/hooks/useQueueActions";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/Button";
import { RecentlyPlayed } from "@/components/room/RecentlyPlayed";
import { RoomHistory } from "@/components/room/RoomHistory";

interface QueueProps {
  queue: QueueItemDTO[];
  roomId: string;
  sessionId: string;
  repeatQueue: boolean;
  settings: RoomSettingsDTO;
  hostSessionId: string | null;
  presence: Record<string, PresenceStateDTO>;
}

export function Queue({ queue, roomId, sessionId, repeatQueue, settings, hostSessionId, presence }: QueueProps) {
  const actions = useQueueActions(roomId, sessionId);
  const [clearOpen, setClearOpen] = useState(false);

  const permissionCtx = { hostSessionId, ...settings };
  const isHost = checkIsHost(permissionCtx, sessionId);
  const canEdit = canEditQueue(permissionCtx, sessionId);
  const canShuffleClear = canShuffleOrClear(permissionCtx, sessionId);
  const editors = Object.values(presence).filter((p) => p.activity === "editing_queue" && p.sessionId !== sessionId);
  const remainingSeconds = queue.reduce((total, item) => total + item.duration, 0);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Queue</Text>
        <Text style={styles.count}>
          ({queue.length}){queue.length > 0 && ` · ${formatDuration(remainingSeconds)} left`}
        </Text>
        <View style={styles.headerActions}>
          <RecentlyPlayed roomId={roomId} />
          <RoomHistory roomId={roomId} />
          {isHost && (
            <IconButton
              active={settings.queueLocked}
              label={settings.queueLocked ? "🔒" : "🔓"}
              onPress={() => getSocket().emit(SocketEvents.SET_QUEUE_LOCK, { roomId, locked: !settings.queueLocked })}
            />
          )}
          <IconButton active={repeatQueue} label="🔁" disabled={!isHost} onPress={() => actions.setRepeat(!repeatQueue)} />
          <IconButton label="🔀" disabled={!canShuffleClear || queue.length < 2} onPress={() => actions.shuffle()} />
          <IconButton label="🗑️" disabled={!canShuffleClear || queue.length === 0} onPress={() => setClearOpen(true)} />
        </View>
      </View>

      {settings.queueLocked && <Text style={styles.hint}>🔒 The queue is locked — only the host can make changes.</Text>}
      {editors.length > 0 && (
        <Text style={styles.hint}>
          {editors.map((e) => e.displayName).join(", ")} {editors.length === 1 ? "is" : "are"} editing the queue…
        </Text>
      )}

      {queue.length === 0 ? (
        <Text style={styles.emptyText}>Queue is empty. Paste a YouTube link above to add one.</Text>
      ) : (
        <View style={styles.list}>
          {queue.map((item, index) => (
            <QueueRow
              key={item.id}
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === queue.length - 1}
              canEdit={canEdit}
              onMoveUp={() => actions.moveUp(item.id)}
              onMoveDown={() => actions.moveDown(item.id)}
              onRemove={() => actions.remove(item.id)}
            />
          ))}
        </View>
      )}

      <Modal visible={clearOpen} transparent animationType="fade" onRequestClose={() => setClearOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Clear the queue?</Text>
            <Text style={styles.modalBody}>
              This removes all {queue.length} queued song{queue.length === 1 ? "" : "s"} for everyone in the room. The
              currently playing song isn&apos;t affected.
            </Text>
            <View style={styles.modalActions}>
              <Button variant="secondary" onPress={() => setClearOpen(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={actions.isClearing}
                onPress={() => {
                  actions.clear();
                  setClearOpen(false);
                }}
                style={{ flex: 1 }}
              >
                Clear queue
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function IconButton({ label, onPress, active, disabled }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconButton, active && styles.iconButtonActive, disabled && styles.iconButtonDisabled]}
    >
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

function QueueRow({
  item,
  index,
  isFirst,
  isLast,
  canEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: QueueItemDTO;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.rowItem}>
      <Text style={styles.rowIndex}>{index + 1}</Text>
      <Image source={{ uri: item.thumbnail }} style={styles.rowThumb} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          Added by {item.addedByName} · {formatDuration(item.duration)}
        </Text>
      </View>
      {canEdit && (
        <View style={styles.rowActions}>
          <Pressable onPress={onMoveUp} disabled={isFirst} style={[styles.rowActionButton, isFirst && styles.iconButtonDisabled]}>
            <Text style={styles.rowActionText}>↑</Text>
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={isLast} style={[styles.rowActionButton, isLast && styles.iconButtonDisabled]}>
            <Text style={styles.rowActionText}>↓</Text>
          </Pressable>
          <Pressable onPress={onRemove} style={styles.rowActionButton}>
            <Text style={styles.rowActionText}>✕</Text>
          </Pressable>
        </View>
      )}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  count: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: "auto",
  },
  iconButton: {
    height: 32,
    width: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  iconButtonText: {
    fontSize: 13,
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  list: {
    gap: 2,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowIndex: {
    color: colors.mutedForeground,
    fontSize: 12,
    width: 16,
    textAlign: "right",
  },
  rowThumb: {
    height: 40,
    width: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
  },
  rowInfo: {
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
  rowActions: {
    flexDirection: "row",
    gap: 2,
  },
  rowActionButton: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  rowActionText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000A0",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  modalBody: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
