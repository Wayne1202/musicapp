import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SocketEvents } from "@musicapp/shared";
import type { QueueAddPermission, RoomSettingsDTO, SkipMode, UpdateRoomSettingsRequest } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/Button";

interface RoomSettingsDialogProps {
  roomId: string;
  settings: RoomSettingsDTO;
  isHost: boolean;
}

export function RoomSettingsDialog({ roomId, settings, isHost }: RoomSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const update = (patch: UpdateRoomSettingsRequest) => {
    getSocket().emit(SocketEvents.UPDATE_ROOM_SETTINGS, { roomId, settings: patch });
  };

  const handleEndRoom = () => {
    getSocket().emit(SocketEvents.END_ROOM, { roomId });
    setConfirmingEnd(false);
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setConfirmingEnd(false);
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>⚙️</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Room settings</Text>
            <Text style={styles.subtitle}>{isHost ? "Changes apply instantly for everyone in the room." : "Only the host can change these."}</Text>

            <ScrollView style={styles.scroll}>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Who can add songs</Text>
                <SegmentedControl<QueueAddPermission>
                  value={settings.queueAddPermission}
                  disabled={!isHost}
                  onChange={(queueAddPermission) => update({ queueAddPermission })}
                  options={[
                    { value: "ANYONE", label: "Anyone" },
                    { value: "HOST_ONLY", label: "Host only" },
                  ]}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Who can skip</Text>
                <SegmentedControl<SkipMode>
                  value={settings.skipMode}
                  disabled={!isHost}
                  onChange={(skipMode) => update({ skipMode })}
                  options={[
                    { value: "ANYONE", label: "Anyone" },
                    { value: "HOST_ONLY", label: "Host only" },
                    { value: "VOTE", label: "Vote" },
                  ]}
                />
              </View>

              <ToggleRow
                label="Allow guests to reorder queue"
                description="Move / remove. Shuffle and clear always stay host-only."
                enabled={settings.allowGuestReorder}
                disabled={!isHost}
                onToggle={() => update({ allowGuestReorder: !settings.allowGuestReorder })}
              />
              <ToggleRow
                label="Auto-shuffle on repeat"
                description="Reshuffle remaining order each time repeat recycles a song."
                enabled={settings.autoShuffle}
                disabled={!isHost}
                onToggle={() => update({ autoShuffle: !settings.autoShuffle })}
              />
              <ToggleRow
                label="Play music when queue is empty"
                description="Picks a random trending song instead of going idle. Needs a YouTube API key configured on the server."
                enabled={settings.autoplayFallback}
                disabled={!isHost}
                onToggle={() => update({ autoplayFallback: !settings.autoplayFallback })}
              />
              <ToggleRow
                label="Enable chat"
                enabled={settings.chatEnabled}
                disabled={!isHost}
                onToggle={() => update({ chatEnabled: !settings.chatEnabled })}
              />
              <ToggleRow
                label="Enable reactions"
                enabled={settings.reactionsEnabled}
                disabled={!isHost}
                onToggle={() => update({ reactionsEnabled: !settings.reactionsEnabled })}
              />
            </ScrollView>

            {isHost &&
              (confirmingEnd ? (
                <View style={styles.endConfirm}>
                  <Text style={styles.endConfirmText}>
                    End this room? Everyone will be disconnected and the room code will stop working. This can&apos;t
                    be undone.
                  </Text>
                  <View style={styles.endConfirmActions}>
                    <Button variant="secondary" onPress={() => setConfirmingEnd(false)} style={{ flex: 1 }}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onPress={handleEndRoom} style={{ flex: 1 }}>
                      Yes, end room
                    </Button>
                  </View>
                </View>
              ) : (
                <Button variant="destructive" onPress={() => setConfirmingEnd(true)}>
                  End room
                </Button>
              ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        style={[styles.toggleButton, enabled && styles.toggleButtonOn, disabled && styles.toggleButtonDisabled]}
      >
        <Text style={[styles.toggleButtonText, enabled && styles.toggleButtonTextOn]}>{enabled ? "On" : "Off"}</Text>
      </Pressable>
    </View>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          style={[styles.segment, value === option.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
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
    maxWidth: 380,
    maxHeight: "85%",
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
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: -spacing.sm,
  },
  scroll: {
    maxHeight: 380,
  },
  section: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  segmented: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm - 2,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: colors.background,
  },
  segmentText: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.foreground,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleInfo: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  toggleDescription: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleButtonText: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "700",
  },
  toggleButtonTextOn: {
    color: colors.primaryForeground,
  },
  endConfirm: {
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  endConfirmText: {
    color: colors.foreground,
    fontSize: 12,
  },
  endConfirmActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
