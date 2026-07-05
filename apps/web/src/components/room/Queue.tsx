"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ListMusic, Repeat, Shuffle, Trash2, X } from "lucide-react";
import type { QueueItemDTO } from "@musicapp/shared";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/utils";
import { useQueueActions } from "@/hooks/useQueueActions";

interface QueueProps {
  queue: QueueItemDTO[];
  roomId: string;
  sessionId: string;
  repeatQueue: boolean;
}

export function Queue({ queue, roomId, sessionId, repeatQueue }: QueueProps) {
  const actions = useQueueActions(roomId, sessionId);
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ListMusic className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Queue</h3>
        <span className="text-sm text-muted-foreground">({queue.length})</span>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="icon"
            variant={repeatQueue ? "default" : "outline"}
            title={repeatQueue ? "Repeat is on" : "Repeat is off"}
            aria-pressed={repeatQueue}
            disabled={actions.isTogglingRepeat}
            onClick={() => actions.setRepeat(!repeatQueue)}
          >
            <Repeat className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            title="Shuffle queue"
            disabled={queue.length < 2 || actions.isShuffling}
            onClick={() => actions.shuffle()}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" title="Clear queue" disabled={queue.length === 0}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Clear the queue?</DialogTitle>
                <DialogDescription>
                  This removes all {queue.length} queued song{queue.length === 1 ? "" : "s"} for everyone in the
                  room. The currently playing song isn&apos;t affected.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setClearOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={actions.isClearing}
                  onClick={() => {
                    actions.clear();
                    setClearOpen(false);
                  }}
                >
                  Clear queue
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {queue.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Queue is empty. Paste a YouTube link above to add one.
        </p>
      ) : (
        <ScrollArea className="h-72 pr-2">
          <ol className="flex flex-col gap-1">
            {queue.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary/60">
                <span className="w-5 shrink-0 text-right text-sm text-muted-foreground">{index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">Added by {item.addedByName}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(item.duration)}</span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 sm:h-7 sm:w-7"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => actions.moveUp(item.id)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 sm:h-7 sm:w-7"
                    title="Move down"
                    disabled={index === queue.length - 1}
                    onClick={() => actions.moveDown(item.id)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 sm:h-7 sm:w-7"
                    title="Remove from queue"
                    onClick={() => actions.remove(item.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </ScrollArea>
      )}
    </div>
  );
}
