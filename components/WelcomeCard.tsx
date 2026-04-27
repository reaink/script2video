"use client";

import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { Settings } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function WelcomeCard() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 py-24">
      <Card>
        <Card.Content className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">{t.welcomeTitle}</h1>
          <p className="text-default-600">{t.welcomeDesc}</p>
          <div>
            <Link href="/settings">
              <Button variant="primary" className="gap-1.5"><Settings className="size-4" />{t.welcomeGoSettings}</Button>
            </Link>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
