import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function ApiDocsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fdocs%2Fapi");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <a href="/profile" className="text-sm font-bold text-slate-600">← API access</a>
        <h1 className="mt-5 text-4xl font-black tracking-tight">Sheriff API</h1>
        <p className="mt-3 leading-7 text-slate-600">Automate uploads and downloads for your own account with a scoped personal access token. Tokens never grant access to another user&apos;s files.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">{[["files:read", "List and download"], ["files:write", "Upload and update"], ["files:delete", "Trash and restore"]].map(([scope, copy]) => <div key={scope} className="rounded-2xl bg-slate-50 p-4"><code className="text-sm font-bold">{scope}</code><p className="mt-2 text-xs text-slate-500">{copy}</p></div>)}</div>
        <h2 className="mt-9 text-xl font-extrabold">Upload in three calls</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>POST file metadata to <code>/api/v1/files</code>.</li><li>PUT the exact bytes and content type to the returned temporary URL.</li><li>POST <code>/api/v1/files/:id/complete</code> so Sheriff verifies the R2 object.</li></ol>
        <div className="mt-8 flex flex-wrap gap-3"><a href="/openapi.yaml" className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white">OpenAPI 3.1 contract</a><a href="/profile" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Manage tokens</a></div>
        <p className="mt-8 text-sm leading-6 text-slate-500">General limit: 120 requests/minute. Upload calls: 20/minute. Signed upload and download URLs expire after 15 minutes. Full curl walkthrough: <code>docs/api.md</code> in the repository.</p>
      </article>
    </main>
  );
}
