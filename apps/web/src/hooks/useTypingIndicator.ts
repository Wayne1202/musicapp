"use client";

import { useEffect, useMemo, useRef } from "react";
import { SocketEvents } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

const IDLE_TIMEOUT_MS = 2000;

/** Emits TYPING(true) on keystrokes (auto-clearing after a short idle period) and TYPING(false)
 *  on demand — used by AddSongForm so other users see "adding a song…" next to that person's
 *  name while they're typing a URL. */
export function useTypingIndicator(roomId: string | null) {
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, []);

  return useMemo(() => {
    const socket = getSocket();

    const stopTyping = () => {
      if (idleTimeout.current) {
        clearTimeout(idleTimeout.current);
        idleTimeout.current = null;
      }
      if (!roomId) return;
      socket.emit(SocketEvents.TYPING, { roomId, isTyping: false });
    };

    const notifyTyping = () => {
      if (!roomId) return;
      socket.emit(SocketEvents.TYPING, { roomId, isTyping: true });
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      idleTimeout.current = setTimeout(stopTyping, IDLE_TIMEOUT_MS);
    };

    return { notifyTyping, stopTyping };
  }, [roomId]);
}
