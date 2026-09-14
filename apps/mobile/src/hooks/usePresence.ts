import { useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SocketEvents } from "@musicapp/shared";
import type { PresenceActivity } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";

const IDLE_TIMEOUT_MS = 2000;
const AWAY_AFTER_MS = 60_000;

/**
 * Mobile counterpart to apps/web's usePresence. Same activity-pulse idea (typing/adding-song/
 * editing-queue, auto-clearing to idle), but away/online status is driven by RN's AppState
 * (foreground/background) instead of the web version's document.visibilitychange + window
 * mousemove/keydown/touchstart/scroll listeners, which have no RN equivalent.
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

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === "active") resetAwayTimer();
      else setStatus("away");
    };

    const sub = AppState.addEventListener("change", onAppStateChange);
    resetAwayTimer();

    return () => {
      sub.remove();
      if (awayTimeout.current) clearTimeout(awayTimeout.current);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, [roomId, socket]);

  return { notifyActivity, clearActivity };
}
