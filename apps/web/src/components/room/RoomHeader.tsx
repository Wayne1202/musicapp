"use client";

import { useState } from "react";
import { Check, Copy, Users, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RoomHeader({
  roomName,
  roomCode,
  onlineCount,
  connected,
}: {
  roomName: string;
  roomCode: string;
  onlineCount: number;
  connected: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
        <Button variant="outline" size="sm" onClick={copyInviteLink}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? "Copied" : "Invite"}
        </Button>
      </div>
    </header>
  );
}
