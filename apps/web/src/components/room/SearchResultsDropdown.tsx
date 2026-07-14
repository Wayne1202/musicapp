"use client";

import { Loader2, Plus } from "lucide-react";
import type { SearchResultDTO } from "@musicapp/shared";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";

interface SearchResultsDropdownProps {
  query: string;
  results: SearchResultDTO[];
  isLoading: boolean;
  errorMessage: string | null;
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (result: SearchResultDTO) => void;
  addingVideoId: string | null;
}

/**
 * Renders below the add-song input. Visibility is owned by the caller (AddSongForm) — this
 * component just renders whatever state it's given (loading/error/empty/results), the same
 * "derived from data, not focus" approach ChatPanel's @mention dropdown already uses, so there's
 * no focus/blur race between clicking a result and the input losing focus.
 */
export function SearchResultsDropdown({
  query,
  results,
  isLoading,
  errorMessage,
  highlightedIndex,
  onHighlight,
  onSelect,
  addingVideoId,
}: SearchResultsDropdownProps) {
  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      ) : errorMessage ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{errorMessage}</p>
      ) : results.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No results for &quot;{query}&quot;
        </p>
      ) : (
        <ul role="listbox" className="flex flex-col p-1">
          {results.map((result, index) => (
            <li key={result.videoId}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseEnter={() => onHighlight(index)}
                onClick={() => onSelect(result)}
                disabled={addingVideoId === result.videoId}
                className={`flex w-full items-center gap-3 rounded px-2 py-2 text-left transition ${
                  index === highlightedIndex ? "bg-secondary" : "hover:bg-secondary/60"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.thumbnail} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
                <div className="min-w-0 w-0 flex-1">
                  <p className="truncate text-sm font-medium">{result.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{result.channelTitle}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatDuration(result.duration)}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {addingVideoId === result.videoId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
