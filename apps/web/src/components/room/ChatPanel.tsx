"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { SocketEvents } from "@musicapp/shared";
import type { ChatMessageDTO } from "@musicapp/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { avatarColorClass } from "@/lib/avatarColor";
import { getChatHistory } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { formatClockTime } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 500;

interface ChatPanelProps {
  roomId: string;
  sessionId: string;
  /** New messages received live over the socket since this component mounted (owned by
   *  useRoomSocket, the single place all room socket events are consumed). */
  liveMessages: ChatMessageDTO[];
}

export function ChatPanel({ roomId, sessionId, liveMessages }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const historyQuery = useQuery({
    queryKey: ["chat-history", roomId],
    queryFn: () => getChatHistory(roomId),
  });

  const history = historyQuery.data?.messages ?? [];
  const seenIds = new Set(history.map((m) => m.id));
  const messages = [...history, ...liveMessages.filter((m) => !seenIds.has(m.id))];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    getSocket().emit(SocketEvents.SEND_MESSAGE, { roomId, content: trimmed });
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Chat</h3>
      </div>

      {historyQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <ScrollArea className="h-56 pr-2">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages yet — say hi!</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {messages.map((message) => (
                <li key={message.id} className="flex items-start gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className={`${avatarColorClass(message.sessionId)} text-xs text-white`}>
                      {message.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium">
                        {message.displayName}
                        {message.sessionId === sessionId && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatClockTime(message.createdAt)}</span>
                    </div>
                    <p className="break-words text-sm text-foreground/90">{message.content}</p>
                  </div>
                </li>
              ))}
              <div ref={bottomRef} />
            </ol>
          )}
        </ScrollArea>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the room…"
          maxLength={MAX_MESSAGE_LENGTH}
          className="min-w-0 w-0 flex-1"
          aria-label="Chat message"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
