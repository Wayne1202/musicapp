"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/utils";
import { getRecentlyPlayed } from "@/lib/api";

export function RecentlyPlayed({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);

  // Fetched on-demand rather than pushed over the socket — a history viewer doesn't need
  // split-second live updates, so keeping this a plain fetch-on-open keeps the feature simple.
  const query = useQuery({
    queryKey: ["recently-played", roomId],
    queryFn: () => getRecentlyPlayed(roomId),
    enabled: open,
  });

  const items = query.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Recently played" aria-label="Recently played">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Recently played</DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing played yet.</p>
        ) : (
          <ScrollArea className="h-72 pr-2">
            <ol className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-md px-2 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                  <div className="min-w-0 w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.addedByName ? `Added by ${item.addedByName}` : "Unknown"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(item.duration)}</span>
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
