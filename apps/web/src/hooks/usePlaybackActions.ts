"use client";

import { useMemo } from "react";
import { SocketEvents } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

export function usePlaybackActions(roomId: string | null) {
  return useMemo(() => {
    const socket = getSocket();
    return {
      play: (timestamp: number) => {
        if (!roomId) return;
        socket.emit(SocketEvents.PLAYBACK_PLAY, { roomId, timestamp });
      },
      pause: (timestamp: number) => {
        if (!roomId) return;
        socket.emit(SocketEvents.PLAYBACK_PAUSE, { roomId, timestamp });
      },
      seek: (timestamp: number) => {
        if (!roomId) return;
        socket.emit(SocketEvents.PLAYBACK_SEEK, { roomId, timestamp });
      },
      skip: () => {
        if (!roomId) return;
        socket.emit(SocketEvents.SKIP_SONG, { roomId });
      },
      songEnded: () => {
        if (!roomId) return;
        socket.emit(SocketEvents.SONG_ENDED, { roomId });
      },
    };
  }, [roomId]);
}
