"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, ListMusic, Lock, Repeat, Shuffle, Trash2, Unlock, X } from "lucide-react";
import { canEditQueue, canShuffleOrClear, isHost as checkIsHost, SocketEvents } from "@musicapp/shared";
import type { PresenceStateDTO, QueueItemDTO, RoomSettingsDTO } from "@musicapp/shared";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/utils";
import { useQueueActions } from "@/hooks/useQueueActions";
import { usePresence } from "@/hooks/usePresence";
import { getSocket } from "@/lib/socket";
import { RecentlyPlayed } from "@/components/room/RecentlyPlayed";
import { RoomHistory } from "@/components/room/RoomHistory";

interface QueueProps {
  queue: QueueItemDTO[];
  roomId: string;
  sessionId: string;
  repeatQueue: boolean;
  settings: RoomSettingsDTO;
  hostSessionId: string | null;
  presence: Record<string, PresenceStateDTO>;
}

export function Queue({ queue, roomId, sessionId, repeatQueue, settings, hostSessionId, presence }: QueueProps) {
  const actions = useQueueActions(roomId, sessionId);
  const { notifyActivity, clearActivity } = usePresence(roomId);
  const [clearOpen, setClearOpen] = useState(false);

  const permissionCtx = { hostSessionId, ...settings };
  const isHost = checkIsHost(permissionCtx, sessionId);
  const canEdit = canEditQueue(permissionCtx, sessionId);
  const canShuffleClear = canShuffleOrClear(permissionCtx, sessionId);
  const editors = Object.values(presence).filter((p) => p.activity === "editing_queue" && p.sessionId !== sessionId);

  // Local mirror of the queue order, so a drag can reorder smoothly without waiting on a
  // socket round-trip. Re-synced from the server-driven `queue` prop, except mid-drag (where
  // the incoming prop would otherwise fight the drag preview).
  const [items, setItems] = useState(queue);
  const isDragging = useRef(false);
  useEffect(() => {
    if (!isDragging.current) setItems(queue);
  }, [queue]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = () => {
    if (!canEdit) return;
    isDragging.current = true;
    notifyActivity("editing_queue");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) return;
    isDragging.current = false;
    clearActivity();
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    actions.reorder(reordered.map((item) => item.id));
  };

  const remainingSeconds = items.reduce((total, item) => total + item.duration, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ListMusic className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Queue</h3>
        <span className="text-sm text-muted-foreground">
          ({items.length}){items.length > 0 && ` · ${formatDuration(remainingSeconds)} remaining`}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <RecentlyPlayed roomId={roomId} />
          <RoomHistory roomId={roomId} />
          {isHost && (
            <Button
              size="icon"
              variant={settings.queueLocked ? "default" : "outline"}
              title={settings.queueLocked ? "Unlock queue" : "Lock queue"}
              aria-label={settings.queueLocked ? "Unlock queue" : "Lock queue"}
              aria-pressed={settings.queueLocked}
              onClick={() => getSocket().emit(SocketEvents.SET_QUEUE_LOCK, { roomId, locked: !settings.queueLocked })}
            >
              {settings.queueLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="icon"
            variant={repeatQueue ? "default" : "outline"}
            title={repeatQueue ? "Repeat is on" : "Repeat is off"}
            aria-label={repeatQueue ? "Turn repeat off" : "Turn repeat on"}
            aria-pressed={repeatQueue}
            disabled={!isHost || actions.isTogglingRepeat}
            onClick={() => actions.setRepeat(!repeatQueue)}
          >
            <Repeat className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            title="Shuffle queue"
            aria-label="Shuffle queue"
            disabled={!canShuffleClear || items.length < 2 || actions.isShuffling}
            onClick={() => actions.shuffle()}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                title="Clear queue"
                aria-label="Clear queue"
                disabled={!canShuffleClear || items.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Clear the queue?</DialogTitle>
                <DialogDescription>
                  This removes all {items.length} queued song{items.length === 1 ? "" : "s"} for everyone in the
                  room. The currently playing song isn&apos;t affected.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setClearOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={actions.isClearing}
                  onClick={() => {
                    actions.clear();
                    setClearOpen(false);
                  }}
                >
                  Clear queue
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {settings.queueLocked && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> The queue is locked — only the host can make changes.
        </p>
      )}
      {editors.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {editors.map((e) => e.displayName).join(", ")} {editors.length === 1 ? "is" : "are"} editing the queue…
        </p>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Queue is empty. Paste a YouTube link above to add one.
        </p>
      ) : (
        <ScrollArea className="h-72 pr-2">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              isDragging.current = false;
              clearActivity();
            }}
          >
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-1">
                {items.map((item, index) => (
                  <SortableQueueRow
                    key={item.id}
                    item={item}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === items.length - 1}
                    canEdit={canEdit}
                    onMoveUp={() => actions.moveUp(item.id)}
                    onMoveDown={() => actions.moveDown(item.id)}
                    onRemove={() => actions.remove(item.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </ScrollArea>
      )}
    </div>
  );
}

function SortableQueueRow({
  item,
  index,
  isFirst,
  isLast,
  canEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: QueueItemDTO;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md px-2 py-2 hover:bg-secondary/60 ${isDragging ? "z-10 bg-secondary shadow-lg" : ""}`}
    >
      <button
        {...(canEdit ? attributes : {})}
        {...(canEdit ? listeners : {})}
        disabled={!canEdit}
        aria-label="Drag to reorder"
        className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-4 shrink-0 text-right text-sm text-muted-foreground">{index + 1}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
      <div className="min-w-0 w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">Added by {item.addedByName}</p>
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{formatDuration(item.duration)}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        {/* Up/down buttons are a keyboard/no-JS-drag fallback — dragging is the primary way to
            reorder on touch, and hiding these on narrow screens is what keeps the row from
            overflowing the viewport on a real phone width. */}
        <Button
          size="icon"
          variant="ghost"
          className="hidden h-7 w-7 sm:flex"
          title="Move up"
          aria-label="Move up"
          disabled={!canEdit || isFirst}
          onClick={onMoveUp}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="hidden h-7 w-7 sm:flex"
          title="Move down"
          aria-label="Move down"
          disabled={!canEdit || isLast}
          onClick={onMoveDown}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 sm:h-7 sm:w-7"
          title="Remove from queue"
          aria-label="Remove from queue"
          disabled={!canEdit}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
