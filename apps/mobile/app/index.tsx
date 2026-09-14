import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>musicapp</Text>
      <Text style={styles.subtitle}>Scaffold booting.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
});
