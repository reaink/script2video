import { readSession } from "@/lib/server/session";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { WelcomeCard } from "@/components/WelcomeCard";

export default async function Home() {
  const session = await readSession();
  if (!session) {
    return <WelcomeCard />;
  }
  return <ChatWorkspace />;
}
