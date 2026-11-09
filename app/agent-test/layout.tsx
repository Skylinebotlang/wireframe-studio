// ─────────────────────────────────────────────────────────────────────────────
// AGENT TEST PAGE GATE — /agent-test is a developer page. On the live site it
// answers "not found"; it only opens with `npm run dev`.
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";

export default function AgentTestLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
