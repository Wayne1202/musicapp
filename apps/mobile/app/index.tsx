import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";
import { CreateRoomForm } from "@/components/home/CreateRoomForm";
import { JoinRoomForm } from "@/components/home/JoinRoomForm";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.hero}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🎵</Text>
        </View>
        <Text style={styles.title}>Listen together</Text>
        <Text style={styles.subtitle}>
          Queue YouTube songs, stay in sync with friends, and keep the music playing while you browse or game.
        </Text>
      </View>

      <Pressable style={styles.karaokeBanner} onPress={() => router.push("/karaoke")}>
        <Text style={styles.karaokeBannerText}>🎤 Try Karaoke — sing live, friends listen in</Text>
      </Pressable>

      <View style={styles.forms}>
        <CreateRoomForm />
        <JoinRoomForm />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBadge: {
    height: 56,
    width: 56,
    borderRadius: 18,
    backgroundColor: colors.primary + "1A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 15,
    textAlign: "center",
    maxWidth: 360,
  },
  forms: {
    gap: spacing.lg,
  },
  karaokeBanner: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  karaokeBannerText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
});
