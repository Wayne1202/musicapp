import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps {
  onPress: () => void;
  children: ReactNode;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ onPress, children, variant = "primary", disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryForeground : colors.foreground} size="small" />
      ) : typeof children === "string" ? (
        <Text style={[styles.text, textVariantStyles[variant]]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
});

const variantStyles: Record<Variant, StyleProp<ViewStyle>> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.destructive },
};

const textVariantStyles: Record<Variant, StyleProp<TextStyle>> = {
  primary: { color: colors.primaryForeground },
  secondary: { color: colors.foreground },
  ghost: { color: colors.foreground },
  destructive: { color: colors.foreground },
};
