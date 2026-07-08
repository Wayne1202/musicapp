"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { canAddSong, isValidYouTubeUrl } from "@musicapp/shared";
import type { RoomSettingsDTO } from "@musicapp/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSong, getErrorMessage } from "@/lib/api";
import { usePresence } from "@/hooks/usePresence";

interface AddSongFormProps {
  roomId: string;
  sessionId: string;
  settings: RoomSettingsDTO;
  hostSessionId: string | null;
}

export function AddSongForm({ roomId, sessionId, settings, hostSessionId }: AddSongFormProps) {
  const [url, setUrl] = useState("");
  const { notifyActivity, clearActivity } = usePresence(roomId);
  const allowed = canAddSong({ hostSessionId, ...settings }, sessionId);

  const mutation = useMutation({
    mutationFn: (value: string) => addSong(roomId, sessionId, value),
    onSuccess: () => {
      setUrl("");
      clearActivity();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const trimmed = url.trim();
  const isValid = trimmed.length === 0 || isValidYouTubeUrl(trimmed);

  if (!allowed) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {settings.queueLocked ? "The queue is locked — only the host can add songs right now." : "Only the host can add songs to this room right now."}
      </div>
    );
  }

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
            if (e.target.value.trim()) notifyActivity("adding_song");
            else clearActivity();
          }}
          onBlur={clearActivity}
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
