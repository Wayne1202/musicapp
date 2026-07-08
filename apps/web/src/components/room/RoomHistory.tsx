"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Music, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClockTime } from "@/lib/utils";
import { getRoomHistory } from "@/lib/api";

export function RoomHistory({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);

  // Fetched on-demand rather than pushed over the socket, same rationale as RecentlyPlayed:
  // a history viewer doesn't need split-second live updates.
  const query = useQuery({
    queryKey: ["room-history", roomId],
    queryFn: () => getRoomHistory(roomId),
    enabled: open,
  });

  const entries = query.data?.entries ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Room history" aria-label="Room history">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Room history</DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing has happened here yet.</p>
        ) : (
          <ScrollArea className="h-80 pr-2">
            <ol className="flex flex-col gap-1">
              {entries.map((entry) => (
                <li
                  key={entry.kind === "event" ? entry.event.id : entry.song.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2"
                >
                  {entry.kind === "song" ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.song.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                      <div className="min-w-0 w-0 flex-1">
                        <p className="truncate text-sm">{entry.song.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.song.addedByName ? `Added by ${entry.song.addedByName}` : "Played"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {entry.event.type === "HOST_TRANSFERRED" ? (
                        <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <p className="min-w-0 w-0 flex-1 truncate text-sm text-muted-foreground">{entry.event.summary}</p>
                    </>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{formatClockTime(entry.at)}</span>
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
