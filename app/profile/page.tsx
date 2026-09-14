import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ApiTokenManager } from "@/components/api-token-manager";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fprofile");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <a href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-black">
          ← Back to dashboard
        </a>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Profile</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">API access</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Create personal access tokens for your own Sheriff files. Tokens inherit your account storage quota and can never access another user&apos;s files.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{session.user.name || "User"}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{session.user.email}</span>
            <a className="rounded-full bg-black px-3 py-1 font-semibold text-white" href="/docs/api">API documentation</a>
          </div>
        </div>
        <ApiTokenManager />
      </div>
    </main>
  );
}
