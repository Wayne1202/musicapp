import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/theme";

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <View style={styles.header}>{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <Text style={styles.description}>{children}</Text>;
}

export function CardContent({ children }: { children: ReactNode }) {
  return <View style={styles.content}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  title: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
  },
  description: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
});
