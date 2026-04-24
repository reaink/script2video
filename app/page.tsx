import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { readSession } from "@/lib/server/session";
import { ChatWorkspace } from "@/components/ChatWorkspace";

export default async function Home() {
  const session = await readSession();
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24">
        <Card>
          <Card.Content className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold">欢迎使用 Script2Video</h1>
            <p className="text-default-600">
              首次使用需要在设置页配置 Provider 与 API Key。当前仅支持 Google Gemini（含 Veo 视频模型）。
            </p>
            <div>
              <Link href="/settings">
                <Button variant="primary">去设置</Button>
              </Link>
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }
  return <ChatWorkspace />;
}
