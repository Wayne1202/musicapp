"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { SocketEvents } from "@musicapp/shared";
import type { ChatMessageDTO, PresenceStateDTO, UserSessionDTO } from "@musicapp/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { avatarColorClass } from "@/lib/avatarColor";
import { getChatHistory } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { formatClockTime } from "@/lib/utils";
import { usePresence } from "@/hooks/usePresence";
import { EmojiPicker } from "@/components/room/EmojiPicker";

const MAX_MESSAGE_LENGTH = 500;
const MAX_MENTION_SUGGESTIONS = 5;

interface ChatPanelProps {
  roomId: string;
  sessionId: string;
  displayName: string;
  onlineUsers: UserSessionDTO[];
  chatEnabled: boolean;
  presence?: Record<string, PresenceStateDTO>;
  /** New messages received live over the socket since this component mounted (owned by
   *  useRoomSocket, the single place all room socket events are consumed). */
  liveMessages: ChatMessageDTO[];
}

/** "Alex is typing…" / "Alex and Ben are typing…" / "Alex, Ben and 2 others are typing…" */
function formatTypingLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing…`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing…`;
}

/** Wraps `@Name` substrings (matched against known display names, longest-first so e.g. "Alex"
 *  doesn't shadow a match for "Alexandra") in a highlighted span. Pure text convention — no
 *  schema change, mentions aren't a stored/structured field. */
function renderWithMentions(content: string, knownNames: string[]) {
  if (knownNames.length === 0) return content;
  const pattern = new RegExp(`@(${knownNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    parts.push(
      <span key={match.index} className="rounded bg-primary/15 px-1 font-medium text-primary">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  parts.push(content.slice(lastIndex));
  return parts;
}

export function ChatPanel({
  roomId,
  sessionId,
  displayName,
  onlineUsers,
  chatEnabled,
  presence = {},
  liveMessages,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { notifyActivity, clearActivity } = usePresence(roomId);
  // Seeded with the count *at mount*, not 0 — so only messages that arrive live after this
  // point are toast-worthy. Using 0 here would replay every already-seen live message as a
  // fresh mention on remount, and merging in history-query messages would toast for arbitrarily
  // old messages once history finishes loading (it resolves async, after this effect's first run).
  const lastSeenLiveCount = useRef(liveMessages.length);

  const historyQuery = useQuery({
    queryKey: ["chat-history", roomId],
    queryFn: () => getChatHistory(roomId),
    enabled: chatEnabled,
  });

  const history = historyQuery.data?.messages ?? [];
  const seenIds = new Set(history.map((m) => m.id));
  const messages = [...history, ...liveMessages.filter((m) => !seenIds.has(m.id))];

  const knownNames = useMemo(() => {
    const names = new Set<string>();
    for (const user of onlineUsers) names.add(user.displayName);
    for (const message of messages) if (message.type === "USER") names.add(message.displayName);
    return Array.from(names).sort((a, b) => b.length - a.length);
  }, [onlineUsers, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Toast when a newly-arrived *live* message mentions this user (own messages excluded).
  useEffect(() => {
    const newMessages = liveMessages.slice(lastSeenLiveCount.current);
    lastSeenLiveCount.current = liveMessages.length;
    for (const message of newMessages) {
      if (message.sessionId === sessionId || message.type !== "USER") continue;
      if (new RegExp(`@${displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(message.content)) {
        toast(`${message.displayName} mentioned you`);
      }
    }
  }, [liveMessages, sessionId, displayName]);

  const typingNames = Object.values(presence)
    .filter((p) => p.activity === "typing_chat" && p.sessionId !== sessionId)
    .map((p) => p.displayName);

  const mentionQuery = /@(\w*)$/.exec(draft)?.[1];
  const mentionMatches =
    mentionQuery !== undefined
      ? onlineUsers
          .filter((u) => u.id !== sessionId && u.displayName.toLowerCase().startsWith(mentionQuery.toLowerCase()))
          .slice(0, MAX_MENTION_SUGGESTIONS)
      : [];

  const insertMention = (name: string) => {
    setDraft((current) => current.replace(/@(\w*)$/, `@${name} `));
  };

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    getSocket().emit(SocketEvents.SEND_MESSAGE, { roomId, content: trimmed });
    setDraft("");
    clearActivity();
  };

  if (!chatEnabled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <MessageCircle className="h-4 w-4" />
        Chat is disabled for this room.
      </div>
    );
  }

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
              {messages.map((message) =>
                message.type === "SYSTEM" ? (
                  <li key={message.id} className="text-center text-xs text-muted-foreground">
                    {message.content}
                  </li>
                ) : (
                  <li key={message.id} className="flex items-start gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className={`${avatarColorClass(message.sessionId ?? message.displayName)} text-xs text-white`}>
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
                      <p className="break-words text-sm text-foreground/90">
                        {renderWithMentions(message.content, knownNames)}
                      </p>
                    </div>
                  </li>
                ),
              )}
              <div ref={bottomRef} />
            </ol>
          )}
        </ScrollArea>
      )}

      {typingNames.length > 0 && (
        <p className="truncate text-xs italic text-muted-foreground">{formatTypingLabel(typingNames)}</p>
      )}

      <form
        className="relative flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        {mentionMatches.length > 0 && (
          <ul className="absolute bottom-full left-0 mb-1 w-48 overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {mentionMatches.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => insertMention(user.displayName)}
                  className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  {user.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) notifyActivity("typing_chat");
            else clearActivity();
          }}
          onBlur={clearActivity}
          placeholder="Message the room…"
          maxLength={MAX_MESSAGE_LENGTH}
          className="min-w-0 w-0 flex-1"
          aria-label="Chat message"
        />
        <EmojiPicker onSelect={(emoji) => setDraft((current) => `${current}${emoji}`)} />
        <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
