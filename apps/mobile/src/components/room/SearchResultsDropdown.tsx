import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { SearchResultDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { formatDuration } from "@/lib/utils";

interface SearchResultsDropdownProps {
  query: string;
  results: SearchResultDTO[];
  isLoading: boolean;
  errorMessage: string | null;
  onSelect: (result: SearchResultDTO) => void;
  addingVideoId: string | null;
}

export function SearchResultsDropdown({ query, results, isLoading, errorMessage, onSelect, addingVideoId }: SearchResultsDropdownProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredRow}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text style={styles.mutedText}>Searching…</Text>
        </View>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Text style={[styles.mutedText, styles.centeredText]}>{errorMessage}</Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.mutedText, styles.centeredText]}>No results for &quot;{query}&quot;</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {results.map((result) => (
        <Pressable
          key={result.videoId}
          onPress={() => onSelect(result)}
          disabled={addingVideoId === result.videoId}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Image source={{ uri: result.thumbnail }} style={styles.thumb} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {result.title}
            </Text>
            <Text style={styles.channel} numberOfLines={1}>
              {result.channelTitle} · {formatDuration(result.duration)}
            </Text>
          </View>
          <View style={styles.addBadge}>
            {addingVideoId === result.videoId ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.addBadgeText}>+</Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  centeredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  centeredText: {
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  mutedText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.secondary,
  },
  thumb: {
    height: 44,
    width: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  channel: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  addBadge: {
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBadgeText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "700",
  },
});
