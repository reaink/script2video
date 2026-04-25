"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export function Navbar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const nextTheme = () => {
    const order = ["system", "light", "dark"] as const;
    const cur = (theme ?? "system") as (typeof order)[number];
    const i = order.indexOf(cur);
    setTheme(order[(i + 1) % order.length]);
  };

  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh");

  return (
    <header className="sticky top-0 z-30 border-b border-default-200 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block size-2 rounded-full bg-primary" />
          Script2Video
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm">{t.navHome}</Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm">{t.navSettings}</Button>
          </Link>
          <Button variant="ghost" size="sm" onPress={nextTheme} aria-label="toggle theme">
            {mounted
              ? theme === "system"
                ? t.navThemeSystem
                : resolvedTheme === "dark"
                  ? t.navThemeDark
                  : t.navThemeLight
              : t.navThemeLoading}
          </Button>
          <Button variant="ghost" size="sm" onPress={toggleLocale} aria-label="toggle language">
            {t.navLangToggle}
          </Button>
        </nav>
      </div>
    </header>
  );
}

