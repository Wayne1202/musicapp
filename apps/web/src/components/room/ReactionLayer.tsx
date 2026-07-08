"use client";

import { useEffect, useState } from "react";
import { REACTION_EMOJIS, SocketEvents } from "@musicapp/shared";
import type { ReactionEmoji } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

const FLOAT_DURATION_MS = 2000;

interface FloatingReaction {
  id: string;
  emoji: ReactionEmoji;
  left: number;
}

/**
 * Reaction bar + the floating-emoji overlay that renders above it, combined into one component
 * since they share the same local "what's currently floating" state. Not wired through
 * useRoomSocket's central reducer — reactions are pure ephemeral animation, never read back
 * as room state, so a direct socket subscription here keeps them out of every other
 * component's re-render path.
 */
export function ReactionLayer({
  roomId,
  sessionId,
  reactionsEnabled,
}: {
  roomId: string;
  sessionId: string;
  reactionsEnabled: boolean;
}) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onReceived = ({ id, emoji, sessionId: fromSessionId }: { id: string; emoji: ReactionEmoji; sessionId: string }) => {
      if (fromSessionId === sessionId) return; // sender already animated this one optimistically
      addFloating(id, emoji);
    };
    socket.on(SocketEvents.REACTION_RECEIVED, onReceived);
    return () => {
      socket.off(SocketEvents.REACTION_RECEIVED, onReceived);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const addFloating = (id: string, emoji: ReactionEmoji) => {
    const left = 15 + Math.random() * 70;
    setFloating((current) => [...current, { id, emoji, left }]);
    setTimeout(() => {
      setFloating((current) => current.filter((r) => r.id !== id));
    }, FLOAT_DURATION_MS);
  };

  const send = (emoji: ReactionEmoji) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addFloating(id, emoji);
    getSocket().emit(SocketEvents.SEND_REACTION, { roomId, emoji });
  };

  if (!reactionsEnabled) return null;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden">
        {floating.map((r) => (
          <span
            key={r.id}
            className="reaction-float absolute bottom-0 text-2xl"
            style={{ left: `${r.left}%` }}
            aria-hidden
          >
            {r.emoji}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1 sm:gap-1.5">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg transition hover:bg-secondary active:scale-90 sm:h-9 sm:w-9"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
