import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SocketEvents } from "@musicapp/shared";
import type { ChatMessageDTO, PresenceStateDTO, UserSessionDTO } from "@musicapp/shared";
import { colors, radius, spacing } from "@/theme";
import { avatarColor } from "@/lib/avatarColor";
import { getChatHistory } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { formatClockTime } from "@/lib/utils";
import { usePresence } from "@/hooks/usePresence";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

const MAX_MESSAGE_LENGTH = 500;

function formatTypingLabel(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing…`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing…`;
}

interface ChatPanelProps {
  roomId: string;
  sessionId: string;
  displayName: string;
  onlineUsers: UserSessionDTO[];
  chatEnabled: boolean;
  presence?: Record<string, PresenceStateDTO>;
  liveMessages: ChatMessageDTO[];
}

export function ChatPanel({ roomId, sessionId, displayName, onlineUsers, chatEnabled, presence = {}, liveMessages }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const { notifyActivity, clearActivity } = usePresence(roomId);
  const lastSeenLiveCount = useRef(liveMessages.length);

  const historyQuery = useQuery({
    queryKey: ["chat-history", roomId],
    queryFn: () => getChatHistory(roomId),
    enabled: chatEnabled,
  });

  const history = historyQuery.data?.messages ?? [];
  const seenIds = new Set(history.map((m) => m.id));
  const messages = [...history, ...liveMessages.filter((m) => !seenIds.has(m.id))];

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

  const typingNames = useMemo(
    () =>
      Object.values(presence)
        .filter((p) => p.activity === "typing_chat" && p.sessionId !== sessionId)
        .map((p) => p.displayName),
    [presence, sessionId],
  );

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    getSocket().emit(SocketEvents.SEND_MESSAGE, { roomId, content: trimmed });
    setDraft("");
    clearActivity();
  };

  if (!chatEnabled) {
    return (
      <View style={styles.card}>
        <Text style={styles.mutedText}>💬 Chat is disabled for this room.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Chat</Text>

      {historyQuery.isLoading ? (
        <ActivityIndicator color={colors.mutedForeground} style={{ paddingVertical: spacing.lg }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text style={[styles.mutedText, styles.centeredText]}>No messages yet — say hi!</Text>
          ) : (
            messages.map((message) =>
              message.type === "SYSTEM" ? (
                <Text key={message.id} style={styles.systemMessage}>
                  {message.content}
                </Text>
              ) : (
                <View key={message.id} style={styles.messageRow}>
                  <Avatar name={message.displayName} color={avatarColor(message.sessionId ?? message.displayName)} size={26} />
                  <View style={styles.messageBody}>
                    <View style={styles.messageMeta}>
                      <Text style={styles.messageAuthor} numberOfLines={1}>
                        {message.displayName}
                        {message.sessionId === sessionId ? " (you)" : ""}
                      </Text>
                      <Text style={styles.messageTime}>{formatClockTime(message.createdAt)}</Text>
                    </View>
                    <Text style={styles.messageContent}>{message.content}</Text>
                  </View>
                </View>
              ),
            )
          )}
        </ScrollView>
      )}

      {typingNames.length > 0 && <Text style={styles.typingText}>{formatTypingLabel(typingNames)}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (text.trim()) notifyActivity("typing_chat");
            else clearActivity();
          }}
          onBlur={clearActivity}
          placeholder="Message the room…"
          placeholderTextColor={colors.mutedForeground}
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <Button onPress={handleSend} disabled={!draft.trim()} style={styles.sendButton}>
          ➤
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  mutedText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  centeredText: {
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  messageList: {
    maxHeight: 240,
  },
  systemMessage: {
    color: colors.mutedForeground,
    fontSize: 11,
    textAlign: "center",
    paddingVertical: spacing.xs,
  },
  messageRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  messageBody: {
    flex: 1,
    minWidth: 0,
  },
  messageMeta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  messageAuthor: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  messageTime: {
    color: colors.mutedForeground,
    fontSize: 10,
  },
  messageContent: {
    color: colors.foreground,
    fontSize: 13,
    marginTop: 1,
  },
  typingText: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontStyle: "italic",
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
    fontSize: 14,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
  },
});
