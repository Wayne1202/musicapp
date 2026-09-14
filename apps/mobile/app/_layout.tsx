import { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/theme";
import { ToastHost } from "@/components/ToastHost";
import { createQueryClient } from "@/lib/queryClient";

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <ToastHost />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
