"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { Globe, Home, Monitor, Moon, Settings, Sun } from "lucide-react";
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
          <a href="https://github.com/reaink/script2video" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <Button variant="ghost" size="sm" isIconOnly>
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.579.688.481C19.138 20.2 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" /></svg>
            </Button>
          </a>
          <Link href="/">
            <Button variant="ghost" size="sm" isIconOnly aria-label="Home">
              <Home className="size-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm" isIconOnly aria-label="Settings">
              <Settings className="size-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" isIconOnly onPress={nextTheme} aria-label="toggle theme">
            {mounted
              ? theme === "system"
                ? <Monitor className="size-4" />
                : resolvedTheme === "dark"
                  ? <Moon className="size-4" />
                  : <Sun className="size-4" />
              : <Monitor className="size-4" />}
          </Button>
          <Button variant="ghost" size="sm" onPress={toggleLocale} aria-label="toggle language" className="gap-1.5">
            <Globe className="size-4" />{t.navLangToggle}
          </Button>
        </nav>
      </div>
    </header>
  );
}

