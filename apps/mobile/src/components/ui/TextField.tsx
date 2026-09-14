import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing } from "@/theme";

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.foreground,
    fontSize: 15,
  },
});
