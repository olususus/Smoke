"use client";

import { GitProvider } from "./context/GitContext";
import { SettingsProvider } from "./context/SettingsContext";
import { AppGate } from "./components/AppGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppGate>
      <SettingsProvider>
        <GitProvider>{children}</GitProvider>
      </SettingsProvider>
    </AppGate>
  );
}
