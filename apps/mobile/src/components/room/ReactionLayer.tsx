import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { REACTION_EMOJIS, SocketEvents } from "@musicapp/shared";
import type { ReactionEmoji } from "@musicapp/shared";
import { getSocket } from "@/lib/socket";
import { spacing } from "@/theme";

const FLOAT_DURATION_MS = 2000;

interface FloatingReaction {
  id: string;
  emoji: ReactionEmoji;
  left: number;
}

export function ReactionLayer({ roomId, sessionId, reactionsEnabled }: { roomId: string; sessionId: string; reactionsEnabled: boolean }) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onReceived = ({ id, emoji, sessionId: fromSessionId }: { id: string; emoji: ReactionEmoji; sessionId: string }) => {
      if (fromSessionId === sessionId) return;
      addFloating(id, emoji);
    };
    socket.on(SocketEvents.REACTION_RECEIVED, onReceived);
    return () => {
      socket.off(SocketEvents.REACTION_RECEIVED, onReceived);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const addFloating = (id: string, emoji: ReactionEmoji) => {
    const left = 15 + Math.random() * 70;
    setFloating((current) => [...current, { id, emoji, left }]);
    setTimeout(() => {
      setFloating((current) => current.filter((r) => r.id !== id));
    }, FLOAT_DURATION_MS);
  };

  const send = (emoji: ReactionEmoji) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addFloating(id, emoji);
    getSocket().emit(SocketEvents.SEND_REACTION, { roomId, emoji });
  };

  if (!reactionsEnabled) return null;

  return (
    <View>
      <View style={styles.floatArea} pointerEvents="none">
        {floating.map((r) => (
          <FloatingEmoji key={r.id} emoji={r.emoji} left={r.left} />
        ))}
      </View>
      <View style={styles.bar}>
        {REACTION_EMOJIS.map((emoji) => (
          <Pressable key={emoji} onPress={() => send(emoji)} style={styles.button}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FloatingEmoji({ emoji, left }: { emoji: ReactionEmoji; left: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: FLOAT_DURATION_MS - 300, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.15, duration: FLOAT_DURATION_MS - 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -160, duration: FLOAT_DURATION_MS - 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [opacity, scale, translateY]);

  return (
    <Animated.Text
      style={[styles.floatingEmoji, { left: `${left}%`, opacity, transform: [{ translateY }, { scale }] }]}
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  floatArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 128,
    overflow: "hidden",
  },
  floatingEmoji: {
    position: "absolute",
    bottom: 0,
    fontSize: 24,
  },
  bar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  button: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  emoji: {
    fontSize: 18,
  },
});
