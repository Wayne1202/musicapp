"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { isValidYouTubeUrl } from "@musicapp/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSong, getErrorMessage } from "@/lib/api";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

export function AddSongForm({ roomId, sessionId }: { roomId: string; sessionId: string }) {
  const [url, setUrl] = useState("");
  const { notifyTyping, stopTyping } = useTypingIndicator(roomId);

  const mutation = useMutation({
    mutationFn: (value: string) => addSong(roomId, sessionId, value),
    onSuccess: () => {
      setUrl("");
      stopTyping();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const trimmed = url.trim();
  const isValid = trimmed.length === 0 || isValidYouTubeUrl(trimmed);

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValidYouTubeUrl(trimmed)) return;
        mutation.mutate(trimmed);
      }}
    >
      <div className="flex gap-2">
        <Input
          placeholder="Paste a YouTube link (youtube.com, youtu.be, or music.youtube.com)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (e.target.value.trim()) notifyTyping();
            else stopTyping();
          }}
          onBlur={stopTyping}
          aria-invalid={!isValid}
          className="min-w-0 w-0 flex-1"
        />
        <Button type="submit" disabled={!trimmed || !isValid || mutation.isPending} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          {mutation.isPending ? "Adding..." : "Add"}
        </Button>
      </div>
      {!isValid && <p className="text-sm text-destructive">That doesn&apos;t look like a valid YouTube URL.</p>}
    </form>
  );
}
