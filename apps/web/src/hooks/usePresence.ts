"use client";

import { useEffect, useMemo, useRef } from "react";
import { SocketEvents } from "@musicapp/shared";
import type { PresenceActivity } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

const IDLE_TIMEOUT_MS = 2000;
const AWAY_AFTER_MS = 60_000;

/**
 * Owns this tab's presence broadcast: activity pulses (typing in chat / adding a song /
 * editing the queue, auto-clearing back to idle after a short pause — same idea as the old
 * per-feature typing indicator, just generalized) plus away/online status driven by tab
 * visibility and user input activity. One hook per room view; components call
 * `notifyActivity` on the interactions they care about instead of owning their own socket
 * wiring.
 */
export function usePresence(roomId: string | null) {
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAway = useRef(false);

  const socket = useMemo(() => getSocket(), []);

  const notifyActivity = useMemo(
    () => (activity: PresenceActivity) => {
      if (!roomId) return;
      socket.emit(SocketEvents.PRESENCE_UPDATE, { roomId, activity });
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      if (activity !== "idle") {
        idleTimeout.current = setTimeout(() => {
          socket.emit(SocketEvents.PRESENCE_UPDATE, { roomId, activity: "idle" });
        }, IDLE_TIMEOUT_MS);
      }
    },
    [roomId, socket],
  );

  const clearActivity = useMemo(() => () => notifyActivity("idle"), [notifyActivity]);

  useEffect(() => {
    if (!roomId) return;

    const setStatus = (status: "online" | "away") => {
      if (isAway.current === (status === "away")) return;
      isAway.current = status === "away";
      socket.emit(SocketEvents.PRESENCE_UPDATE, { roomId, status });
    };

    const resetAwayTimer = () => {
      setStatus("online");
      if (awayTimeout.current) clearTimeout(awayTimeout.current);
      awayTimeout.current = setTimeout(() => setStatus("away"), AWAY_AFTER_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setStatus("away");
      } else {
        resetAwayTimer();
      }
    };

    const activityEvents = ["mousemove", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach((event) => window.addEventListener(event, resetAwayTimer, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);

    resetAwayTimer();

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, resetAwayTimer));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (awayTimeout.current) clearTimeout(awayTimeout.current);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, [roomId, socket]);

  return { notifyActivity, clearActivity };
}
