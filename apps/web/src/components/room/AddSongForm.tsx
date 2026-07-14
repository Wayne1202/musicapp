"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { canAddSong, isValidYouTubeUrl } from "@musicapp/shared";
import type { RoomSettingsDTO, SearchResultDTO } from "@musicapp/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSong, addSongByVideoId, getErrorMessage, searchSongs } from "@/lib/api";
import { usePresence } from "@/hooks/usePresence";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SearchResultsDropdown } from "@/components/room/SearchResultsDropdown";

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
  const [dismissed, setDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const { notifyActivity, clearActivity } = usePresence(roomId);
  const allowed = canAddSong({ hostSessionId, ...settings }, sessionId);

  const trimmed = query.trim();
  const isUrl = isValidYouTubeUrl(trimmed);
  const debouncedQuery = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);

  const shouldSearch = allowed && !dismissed && !isUrl && debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ["youtube-search", roomId, debouncedQuery],
    queryFn: () => searchSongs(roomId, sessionId, debouncedQuery),
    enabled: shouldSearch,
    staleTime: 5 * 60 * 1000, // matches the server's own ~1h cache being the real source of truth
    // Search errors (no API key, quota exceeded, ...) aren't worth TanStack Query's default
    // retry-3x-with-backoff — that just leaves the UI stuck on "Searching…" for several seconds
    // before finally showing the error. Typing more re-queries naturally anyway.
    retry: false,
  });

  // Reset the keyboard-nav highlight whenever a fresh set of results comes in.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery.data]);

  // Escape sets `dismissed`; the next keystroke clears it so search resumes naturally.
  useEffect(() => {
    setDismissed(false);
  }, [query]);

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
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {settings.queueLocked ? "The queue is locked — only the host can add songs right now." : "Only the host can add songs to this room right now."}
      </div>
    );
  }

  const isDebouncing = trimmed.length >= MIN_QUERY_LENGTH && !isUrl && trimmed !== debouncedQuery;
  const showDropdown = trimmed.length >= MIN_QUERY_LENGTH && !isUrl && !dismissed;
  const isLoading = isDebouncing || (shouldSearch && searchQuery.isFetching);
  const results = searchQuery.data?.results ?? [];
  const errorMessage = searchQuery.isError ? getErrorMessage(searchQuery.error) : null;

  const handleSelectResult = (result: SearchResultDTO) => {
    if (addingVideoId) return; // already adding one, ignore extra clicks/enters
    searchAddMutation.mutate(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && !isLoading && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[highlightedIndex];
        if (selected) handleSelectResult(selected);
        return;
      }
    }
    if (e.key === "Escape" && showDropdown) {
      e.preventDefault();
      setDismissed(true);
    }
  };

  const showAddButton = trimmed.length === 0 || isUrl;

  return (
    <form
      className="relative flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValidYouTubeUrl(trimmed)) return;
        urlMutation.mutate(trimmed);
      }}
    >
      <div className="flex gap-2">
        <Input
          placeholder="Search songs or paste a YouTube link..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) notifyActivity("adding_song");
            else clearActivity();
          }}
          onKeyDown={handleKeyDown}
          onBlur={clearActivity}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="min-w-0 w-0 flex-1"
        />
        {showAddButton && (
          <Button type="submit" disabled={!trimmed || !isUrl || urlMutation.isPending} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" />
            {urlMutation.isPending ? "Adding..." : "Add"}
          </Button>
        )}
      </div>

      {showDropdown && (
        <SearchResultsDropdown
          query={trimmed}
          results={results}
          isLoading={isLoading}
          errorMessage={!isLoading ? errorMessage : null}
          highlightedIndex={highlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={handleSelectResult}
          addingVideoId={addingVideoId}
        />
      )}
    </form>
  );
}
