"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Crown, Music2, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import type { RoomRecapDTO } from "@musicapp/shared";
import { getRoomRecap } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Spotify-Wrapped-style summary shown when a room ends — the thing worth screenshotting and
 * sending to the group chat. Built entirely from data already tracked for other reasons (see
 * RoomRecapDTO's comment) — no new persistence, just a read-only aggregation endpoint.
 */
export function RoomRecap({ roomId, roomName }: { roomId: string; roomName: string }) {
  const recapQuery = useQuery({
    queryKey: ["room-recap", roomId],
    queryFn: () => getRoomRecap(roomId),
    retry: false,
  });

  if (recapQuery.isLoading) {
    return <Skeleton className="h-72 w-full max-w-sm rounded-lg" />;
  }

  if (!recapQuery.data) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold">This room has ended</p>
        <p className="text-sm text-muted-foreground">The host closed &quot;{roomName}&quot;.</p>
      </div>
    );
  }

  const { recap } = recapQuery.data;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(recap));
      toast.success("Recap copied — paste it anywhere!");
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  return (
    <Card className="relative w-full max-w-sm overflow-hidden">
      {recap.highlights[0]?.thumbnail && (
        <img
          aria-hidden
          alt=""
          src={recap.highlights[0].thumbnail}
          className="pointer-events-none absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] scale-125 object-cover opacity-30 blur-3xl saturate-150"
        />
      )}
      <CardHeader className="relative">
        <CardTitle className="text-xl">🎉 {recap.roomName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Room {recap.roomCode} · {recap.durationMinutes} min together
        </p>
      </CardHeader>
      <CardContent className="relative flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Music2 className="h-4 w-4" />} value={recap.songsPlayed} label="songs" />
          <Stat icon={<Users className="h-4 w-4" />} value={recap.totalListeners} label="listeners" />
          <Stat icon={<Clock className="h-4 w-4" />} value={recap.durationMinutes} label="minutes" />
        </div>

        {recap.topContributor && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
            <Crown className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>{recap.topContributor.name}</strong> brought the most songs ({recap.topContributor.songCount})
            </span>
          </div>
        )}

        {recap.highlights.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Setlist highlights</p>
            <div className="flex flex-col gap-1.5">
              {recap.highlights.map((song) => (
                <div key={song.id} className="flex items-center gap-2 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={song.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  <span className="line-clamp-1">{song.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleShare} variant="secondary" className="mt-1 gap-2">
          <Share2 className="h-4 w-4" />
          Copy recap to share
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border bg-background/50 py-3">
      <div className="text-primary">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function buildShareText(recap: RoomRecapDTO): string {
  const lines = [
    `🎉 "${recap.roomName}" recap`,
    `${recap.songsPlayed} songs · ${recap.totalListeners} listeners · ${recap.durationMinutes} min together`,
  ];
  if (recap.topContributor) {
    lines.push(`🎧 ${recap.topContributor.name} brought the most songs (${recap.topContributor.songCount})`);
  }
  lines.push("Listen together at musicapp");
  return lines.join("\n");
}
