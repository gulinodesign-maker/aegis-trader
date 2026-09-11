import { AppShell } from "@/components/app-shell";
import { AgentChat } from "@/components/agent-chat";

export default function AgentPage() {
  return <AppShell title="Agent" subtitle="Tool-grounded trade reasoning"><AgentChat /></AppShell>;
}
