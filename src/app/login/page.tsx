import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getEnv } from "@/config/env";
import { LoginForm } from "@/components/login-form";
import { SESSION_COOKIE, verifySessionToken } from "@/security/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const env = getEnv();
  if (env.DEMO_MODE || env.AUTH_MODE === "demo") redirect("/");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (env.APP_SESSION_SECRET && verifySessionToken(token, env.APP_SESSION_SECRET)) redirect("/");
  return (
    <main className="app-width safe-top min-h-dvh px-4 pb-8">
      <p className="text-[11px] font-semibold tracking-[.12em] text-slate-500">AEGIS TRADER</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Private trading console</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">Authentication protects the app surface. Broker, database and AI secrets remain server-only.</p>
      <LoginForm />
    </main>
  );
}
