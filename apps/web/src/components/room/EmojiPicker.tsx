"use client";

import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Curated grid rather than a full emoji library — keeps the picker self-contained (no new
// dependency, no CDN emoji-data fetch) while covering the common chat reactions/expressions.
const EMOJIS = [
  "😀", "😂", "😅", "😍", "😎", "🤔", "😢", "😭", "😡", "🥳",
  "😴", "🤯", "🙌", "👏", "👍", "👎", "🙏", "💪", "🤝", "✌️",
  "❤️", "🔥", "🎉", "✨", "🎵", "🎶", "🎤", "🎧", "⭐", "💯",
  "😳", "🤩", "🥲", "😬", "🙃", "🫡", "💀", "👀", "🍕", "☕",
] as const;

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label="Add emoji">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-secondary"
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
