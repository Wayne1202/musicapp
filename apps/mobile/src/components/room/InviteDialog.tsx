import { useState } from "react";
import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { colors, radius, spacing } from "@/theme";
import { Button } from "@/components/ui/Button";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN ?? "https://musicapp-web-fawn.vercel.app";

export function InviteDialog({ roomCode, roomName }: { roomCode: string; roomName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${WEB_ORIGIN}/room/${roomCode}`;

  const copyLink = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = () => {
    Share.share({
      title: `Join "${roomName}"`,
      message: `Join my music room "${roomName}" — code ${roomCode}\n${inviteUrl}`,
      url: inviteUrl,
    }).catch(() => {});
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>Invite</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Invite friends to &quot;{roomName}&quot;</Text>
            <Text style={styles.subtitle}>Share the code, link, or QR code below.</Text>

            <View style={styles.center}>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{roomCode}</Text>
              </View>
              <View style={styles.qrWrap}>
                <QRCode value={inviteUrl} size={176} color={colors.background} backgroundColor="#ffffff" />
              </View>
            </View>

            <View style={styles.actions}>
              <Button variant="secondary" onPress={copyLink}>
                {copied ? "✓ Link copied" : "Copy invite link"}
              </Button>
              <Button variant="secondary" onPress={share}>
                Share
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
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
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: -spacing.sm,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
  },
  codeBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  codeText: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 4,
  },
  qrWrap: {
    backgroundColor: "#ffffff",
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
