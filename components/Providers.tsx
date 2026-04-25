"use client";

import { ThemeProvider } from "next-themes";
import { Toast } from "@heroui/react";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Toast.Provider placement="top" />
        {children}
      </ThemeProvider>
    </I18nProvider>
  );
}
