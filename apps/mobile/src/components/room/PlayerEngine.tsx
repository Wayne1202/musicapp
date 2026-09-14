import { StyleSheet, View } from "react-native";
import YoutubeIframe from "react-native-youtube-iframe";
import { colors, radius } from "@/theme";
import type { PlayerController } from "@/hooks/usePlayerController";

const PLAYER_HEIGHT = 220;

/**
 * Unlike apps/web's PlayerEngine (a hidden 2x2px iframe — a browser-tab-audibility hack that has
 * no native equivalent and no benefit here), this renders visibly: there's no reason to hide a
 * native video surface, and a visible player is more idiomatic mobile UX.
 */
export function PlayerEngine({ controller }: { controller: PlayerController }) {
  if (!controller.hasSong) return null;

  return (
    <View style={styles.container}>
      <YoutubeIframe
        ref={controller.playerRef}
        height={PLAYER_HEIGHT}
        videoId={controller.videoId ?? undefined}
        play={controller.shouldPlay}
        onReady={controller.onReady}
        onChangeState={controller.onChangeState}
        onError={controller.onError}
        initialPlayerParams={{ controls: false, rel: false, preventFullScreen: true }}
        webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PLAYER_HEIGHT,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
});
