import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";

const VISIBLE_MS = 2600;

/** Renders one toast at a time (newest wins), auto-dismissing. Mounted once near the root. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeToasts((message) => {
      setCurrent(message);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setCurrent(null));
      }, VISIBLE_MS);
    });
  }, [opacity]);

  if (!current) return null;

  const borderColor =
    current.variant === "success" ? colors.primary : current.variant === "error" ? colors.destructive : colors.border;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { top: insets.top + spacing.sm, opacity, borderColor }]}
    >
      <Text style={styles.text} numberOfLines={2}>
        {current.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 100,
  },
  text: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "500",
  },
});
