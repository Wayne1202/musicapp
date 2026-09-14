import Slider from "@react-native-community/slider";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PlaybackStateDTO } from "@musicapp/shared";
import type { PlayerController } from "@/hooks/usePlayerController";
import { PlayerEngine } from "@/components/room/PlayerEngine";
import { colors, radius, spacing } from "@/theme";
import { formatDuration } from "@/lib/utils";

interface NowPlayingProps {
  playbackState: PlaybackStateDTO | null;
  controller: PlayerController;
}

export function NowPlaying({ playbackState, controller }: NowPlayingProps) {
  const duration = playbackState?.currentDuration ?? 0;

  if (!controller.hasSong) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>Nothing playing yet — add a song below</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <PlayerEngine controller={controller} />

      {!controller.hasInteracted && (
        <Pressable style={styles.unlockOverlay} onPress={controller.handleStart}>
          <Text style={styles.unlockText}>▶ Tap to start playback</Text>
        </Pressable>
      )}

      <Text style={styles.title} numberOfLines={2}>
        {playbackState?.currentTitle ?? ""}
      </Text>
      {playbackState?.currentAddedByName && <Text style={styles.addedBy}>Added by {playbackState.currentAddedByName}</Text>}

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 1}
        value={Math.min(controller.liveTime, duration || controller.liveTime)}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.secondary}
        thumbTintColor={colors.primary}
        onValueChange={controller.handleSeek}
        onSlidingComplete={controller.handleSeekCommit}
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatDuration(controller.liveTime)}</Text>
        <Text style={styles.timeText}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.playButton} onPress={controller.handlePlayPauseTap}>
          <Text style={styles.playButtonText}>{playbackState?.isPlaying ? "⏸" : "▶"}</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={controller.skip}>
          <Text style={styles.skipButtonText}>⏭</Text>
        </Pressable>
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
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  unlockOverlay: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    height: 220,
    borderRadius: radius.md,
    backgroundColor: "#000000A0",
    alignItems: "center",
    justifyContent: "center",
  },
  unlockText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  addedBy: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  slider: {
    width: "100%",
    height: 32,
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -spacing.xs,
  },
  timeText: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
  controls: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  playButton: {
    height: 48,
    width: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonText: {
    color: colors.foreground,
    fontSize: 18,
  },
  skipButton: {
    height: 48,
    width: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButtonText: {
    color: colors.foreground,
    fontSize: 18,
  },
});
