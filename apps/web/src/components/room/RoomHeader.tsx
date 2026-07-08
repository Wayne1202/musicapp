"use client";

import { Users, Wifi, WifiOff } from "lucide-react";
import type { RoomSettingsDTO } from "@musicapp/shared";
import { Badge } from "@/components/ui/badge";
import { RoomSettingsDialog } from "@/components/room/RoomSettingsDialog";
import { InviteDialog } from "@/components/room/InviteDialog";

export function RoomHeader({
  roomId,
  roomName,
  roomCode,
  onlineCount,
  connected,
  settings,
  isHost,
}: {
  roomId: string;
  roomName: string;
  roomCode: string;
  onlineCount: number;
  connected: boolean;
  settings: RoomSettingsDTO;
  isHost: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{roomName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary" className="font-mono tracking-widest">
            {roomCode}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {connected ? <Wifi className="h-3 w-3 text-primary" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Connected" : "Reconnecting..."}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          Online ({onlineCount})
        </span>
        <InviteDialog roomCode={roomCode} roomName={roomName} />
        <RoomSettingsDialog roomId={roomId} settings={settings} isHost={isHost} />
      </div>
    </header>
  );
}
