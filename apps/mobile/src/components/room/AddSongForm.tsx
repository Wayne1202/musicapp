import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { canAddSong, isValidYouTubeUrl } from "@musicapp/shared";
import type { RoomSettingsDTO, SearchResultDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { Button } from "@/components/ui/Button";
import { addSong, addSongByVideoId, getErrorMessage, searchSongs } from "@/lib/api";
import { usePresence } from "@/hooks/usePresence";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SearchResultsDropdown } from "@/components/room/SearchResultsDropdown";
import { toast } from "@/lib/toast";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface AddSongFormProps {
  roomId: string;
  sessionId: string;
  settings: RoomSettingsDTO;
  hostSessionId: string | null;
}

export function AddSongForm({ roomId, sessionId, settings, hostSessionId }: AddSongFormProps) {
  const [query, setQuery] = useState("");
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const { notifyActivity, clearActivity } = usePresence(roomId);
  const allowed = canAddSong({ hostSessionId, ...settings }, sessionId);

  const trimmed = query.trim();
  const isUrl = isValidYouTubeUrl(trimmed);
  const debouncedQuery = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);

  const shouldSearch = allowed && !isUrl && debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ["youtube-search", roomId, debouncedQuery],
    queryFn: () => searchSongs(roomId, sessionId, debouncedQuery),
    enabled: shouldSearch,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const urlMutation = useMutation({
    mutationFn: (value: string) => addSong(roomId, sessionId, value),
    onSuccess: () => {
      setQuery("");
      clearActivity();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const searchAddMutation = useMutation({
    mutationFn: (result: SearchResultDTO) => addSongByVideoId(roomId, sessionId, result),
    onMutate: (result) => setAddingVideoId(result.videoId),
    onSuccess: () => {
      setQuery("");
      clearActivity();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
    onSettled: () => setAddingVideoId(null),
  });

  if (!allowed) {
    return (
      <View style={styles.disabledCard}>
        <Text style={styles.mutedText}>
          {settings.queueLocked ? "The queue is locked — only the host can add songs right now." : "Only the host can add songs to this room right now."}
        </Text>
      </View>
    );
  }

  const isDebouncing = trimmed.length >= MIN_QUERY_LENGTH && !isUrl && trimmed !== debouncedQuery;
  const showDropdown = trimmed.length >= MIN_QUERY_LENGTH && !isUrl;
  const isLoading = isDebouncing || (shouldSearch && searchQuery.isFetching);
  const results = searchQuery.data?.results ?? [];
  const errorMessage = searchQuery.isError ? getErrorMessage(searchQuery.error) : null;
  const showAddButton = trimmed.length === 0 || isUrl;

  const handleSelectResult = (result: SearchResultDTO) => {
    if (addingVideoId) return;
    searchAddMutation.mutate(result);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Search songs or paste a YouTube link..."
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim()) notifyActivity("adding_song");
            else clearActivity();
          }}
          onBlur={clearActivity}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {showAddButton && (
          <Button
            variant="primary"
            disabled={!trimmed || !isUrl || urlMutation.isPending}
            onPress={() => isValidYouTubeUrl(trimmed) && urlMutation.mutate(trimmed)}
            style={styles.addButton}
          >
            {urlMutation.isPending ? "Adding..." : "+ Add"}
          </Button>
        )}
      </View>

      {showDropdown && (
        <SearchResultsDropdown
          query={trimmed}
          results={results}
          isLoading={isLoading}
          errorMessage={!isLoading ? errorMessage : null}
          onSelect={handleSelectResult}
          addingVideoId={addingVideoId}
        />
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
  },
  disabledCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.foreground,
    fontSize: 14,
  },
  addButton: {
    paddingHorizontal: spacing.md,
  },
  mutedText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
});
