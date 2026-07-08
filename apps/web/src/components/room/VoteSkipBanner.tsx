"use client";

import { useEffect, useState } from "react";
import { SkipForward, Users } from "lucide-react";
import type { VoteSkipStateDTO } from "@musicapp/shared";
import { Button } from "@/components/ui/button";

interface VoteSkipBannerProps {
  vote: VoteSkipStateDTO | null;
  sessionId: string;
  /** Whether this user could just press the regular skip button instead of voting. */
  canSkipInstantly: boolean;
  hasSong: boolean;
  onStartVote: () => void;
  onCastVote: () => void;
}

/**
 * Sits between NowPlaying and the queue: either a quiet "start a vote to skip" prompt (shown
 * only to users who can't just skip directly, per the room's skip-mode setting) or a live vote
 * progress banner once one is underway — visible to everyone regardless of permission, since
 * anyone can cast a vote.
 */
export function VoteSkipBanner({ vote, sessionId, canSkipInstantly, hasSong, onStartVote, onCastVote }: VoteSkipBannerProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!vote) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [vote]);

  if (!hasSong) return null;

  if (!vote) {
    if (canSkipInstantly) return null;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
        <p className="min-w-0 w-0 flex-1 text-sm text-muted-foreground">Skipping needs the host, or a majority vote.</p>
        <Button size="sm" variant="outline" onClick={onStartVote} className="shrink-0">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Start vote to skip
        </Button>
      </div>
    );
  }

  const hasVoted = vote.votes.includes(sessionId);
  const secondsLeft = Math.max(0, Math.round((new Date(vote.expiresAt).getTime() - Date.now()) / 1000));
  const pct = Math.min(100, (vote.votes.length / vote.required) * 100);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 w-0 flex-1 text-sm">
          <span className="font-medium">{vote.initiatorName}</span> started a vote to skip —{" "}
          <span className="font-medium">
            {vote.votes.length}/{vote.required}
          </span>{" "}
          votes · {secondsLeft}s left
        </p>
        <Button size="sm" variant={hasVoted ? "secondary" : "default"} disabled={hasVoted} onClick={onCastVote} className="shrink-0">
          <SkipForward className="mr-1.5 h-3.5 w-3.5" />
          {hasVoted ? "Voted" : "Vote to skip"}
        </Button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
