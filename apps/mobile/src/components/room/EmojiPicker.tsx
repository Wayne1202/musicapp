import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/theme";

// Curated grid rather than a full emoji library — same list as apps/web's EmojiPicker.
const EMOJIS = [
  "😀", "😂", "😅", "😍", "😎", "🤔", "😢", "😭", "😡", "🥳",
  "😴", "🤯", "🙌", "👏", "👍", "👎", "🙏", "💪", "🤝", "✌️",
  "❤️", "🔥", "🎉", "✨", "🎵", "🎶", "🎤", "🎧", "⭐", "💯",
  "😳", "🤩", "🥲", "😬", "🙃", "🫡", "💀", "👀", "🍕", "☕",
] as const;

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>🙂</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grid}>
              {EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  style={styles.cell}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerText: {
    fontSize: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#000000A0",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cell: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 18,
  },
});
