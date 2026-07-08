"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { SocketEvents } from "@musicapp/shared";
import type { QueueAddPermission, RoomSettingsDTO, SkipMode, UpdateRoomSettingsRequest } from "@musicapp/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { getSocket } from "@/lib/socket";

interface RoomSettingsDialogProps {
  roomId: string;
  settings: RoomSettingsDTO;
  isHost: boolean;
}

export function RoomSettingsDialog({ roomId, settings, isHost }: RoomSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const update = (patch: UpdateRoomSettingsRequest) => {
    getSocket().emit(SocketEvents.UPDATE_ROOM_SETTINGS, { roomId, settings: patch });
  };

  const handleEndRoom = () => {
    getSocket().emit(SocketEvents.END_ROOM, { roomId });
    setConfirmingEnd(false);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setConfirmingEnd(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Room settings" aria-label="Room settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Room settings</DialogTitle>
          <DialogDescription>
            {isHost ? "Changes apply instantly for everyone in the room." : "Only the host can change these."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col divide-y divide-border">
          <div className="py-2.5">
            <p className="mb-1.5 text-sm font-medium">Who can add songs</p>
            <SegmentedControl<QueueAddPermission>
              value={settings.queueAddPermission}
              disabled={!isHost}
              onChange={(queueAddPermission) => update({ queueAddPermission })}
              options={[
                { value: "ANYONE", label: "Anyone" },
                { value: "HOST_ONLY", label: "Host only" },
              ]}
            />
          </div>

          <div className="py-2.5">
            <p className="mb-1.5 text-sm font-medium">Who can skip</p>
            <SegmentedControl<SkipMode>
              value={settings.skipMode}
              disabled={!isHost}
              onChange={(skipMode) => update({ skipMode })}
              options={[
                { value: "ANYONE", label: "Anyone" },
                { value: "HOST_ONLY", label: "Host only" },
                { value: "VOTE", label: "Vote" },
              ]}
            />
          </div>

          <ToggleRow
            label="Allow guests to reorder queue"
            description="Move / remove / drag-reorder. Shuffle and clear always stay host-only."
            enabled={settings.allowGuestReorder}
            disabled={!isHost}
            onToggle={() => update({ allowGuestReorder: !settings.allowGuestReorder })}
          />
          <ToggleRow
            label="Auto-shuffle on repeat"
            description="Reshuffle remaining order each time repeat recycles a song."
            enabled={settings.autoShuffle}
            disabled={!isHost}
            onToggle={() => update({ autoShuffle: !settings.autoShuffle })}
          />
          <ToggleRow
            label="Enable chat"
            enabled={settings.chatEnabled}
            disabled={!isHost}
            onToggle={() => update({ chatEnabled: !settings.chatEnabled })}
          />
          <ToggleRow
            label="Enable reactions"
            enabled={settings.reactionsEnabled}
            disabled={!isHost}
            onToggle={() => update({ reactionsEnabled: !settings.reactionsEnabled })}
          />
        </div>

        {isHost && (
          <>
            <Separator />
            {confirmingEnd ? (
              <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm">
                  End this room? Everyone will be disconnected and the room code will stop working. This
                  can&apos;t be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmingEnd(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleEndRoom}>
                    Yes, end room
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="destructive" className="w-full" onClick={() => setConfirmingEnd(true)}>
                End room
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Button
        size="sm"
        variant={enabled ? "default" : "outline"}
        disabled={disabled}
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        className="shrink-0"
      >
        {enabled ? "On" : "Off"}
      </Button>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md bg-secondary p-1" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
            value === option.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
