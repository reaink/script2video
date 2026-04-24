"use client";

import { ThemeProvider } from "next-themes";
import { Toast } from "@heroui/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Toast.Provider placement="top" />
      {children}
    </ThemeProvider>
  );
}
