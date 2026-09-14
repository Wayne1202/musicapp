import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VoteSkipStateDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";

interface VoteSkipBannerProps {
  vote: VoteSkipStateDTO | null;
  sessionId: string;
  canSkipInstantly: boolean;
  hasSong: boolean;
  onStartVote: () => void;
  onCastVote: () => void;
}

export function VoteSkipBanner({ vote, sessionId, canSkipInstantly, hasSong, onStartVote, onCastVote }: VoteSkipBannerProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!vote) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [vote]);

  if (!hasSong) return null;

  if (!vote) {
    if (canSkipInstantly) return null;
    return (
      <View style={[styles.card, styles.row]}>
        <Text style={styles.promptText}>Skipping needs the host, or a majority vote.</Text>
        <Pressable style={styles.voteButton} onPress={onStartVote}>
          <Text style={styles.voteButtonText}>👥 Start vote</Text>
        </Pressable>
      </View>
    );
  }

  const hasVoted = vote.votes.includes(sessionId);
  const secondsLeft = Math.max(0, Math.round((new Date(vote.expiresAt).getTime() - Date.now()) / 1000));
  const pct = Math.min(100, (vote.votes.length / vote.required) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.promptText}>
          <Text style={styles.bold}>{vote.initiatorName}</Text> started a vote to skip —{" "}
          <Text style={styles.bold}>
            {vote.votes.length}/{vote.required}
          </Text>{" "}
          votes · {secondsLeft}s left
        </Text>
        <Pressable style={[styles.voteButton, hasVoted && styles.voteButtonVoted]} disabled={hasVoted} onPress={onCastVote}>
          <Text style={styles.voteButtonText}>{hasVoted ? "Voted" : "⏭ Vote"}</Text>
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  promptText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 13,
  },
  bold: {
    fontWeight: "700",
    color: colors.foreground,
  },
  voteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  voteButtonVoted: {
    backgroundColor: colors.secondary,
  },
  voteButtonText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondary,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
