"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const scopes = ["files:read", "files:write", "files:delete"] as const;
type Scope = (typeof scopes)[number];

interface TokenRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Never";
}

export function ApiTokenManager() {
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(["files:read", "files:write"]);
  const [expiresInDays, setExpiresInDays] = useState<30 | 90 | 365 | null>(90);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/tokens", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Unable to load tokens");
      setTokens(body.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createToken(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/settings/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes: selectedScopes, expiresInDays }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Unable to create token");
      setRevealedToken(body.data.token);
      setName("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create token");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token: TokenRecord) {
    if (!window.confirm(`Revoke “${token.name}”? Applications using it will stop working immediately.`)) return;
    const response = await fetch(`/api/settings/tokens/${token.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) return toast.error(body.error?.message || "Unable to revoke token");
    toast.success("Token revoked");
    await load();
  }

  function toggleScope(scope: Scope) {
    setSelectedScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={createToken} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold">Create a token</h2>
        <label className="mt-5 block text-sm font-bold" htmlFor="token-name">Token name</label>
        <input id="token-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="My backup script" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-black" />
        <fieldset className="mt-5">
          <legend className="text-sm font-bold">Permissions</legend>
          <div className="mt-2 space-y-2">
            {scopes.map((scope) => (
              <label key={scope} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
                <span><strong>{scope}</strong><br /><span className="text-xs text-slate-500">{scope === "files:read" ? "List metadata and download" : scope === "files:write" ? "Upload, rename, and change visibility" : "Move files to trash and restore"}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 block text-sm font-bold" htmlFor="expiry">Expires</label>
        <select id="expiry" value={expiresInDays === null ? "never" : expiresInDays} onChange={(event) => setExpiresInDays(event.target.value === "never" ? null : Number(event.target.value) as 30 | 90 | 365)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
          <option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option><option value="never">Never</option>
        </select>
        <button disabled={creating || !name.trim() || selectedScopes.length === 0} className="mt-5 w-full rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {creating ? "Creating…" : "Generate token"}
        </button>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-extrabold">Personal access tokens</h2><p className="mt-1 text-xs text-slate-500">Up to 10 active tokens per account.</p></div></div>
        {revealedToken && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-950">Copy this token now</p>
            <p className="mt-1 text-xs text-amber-800">It is shown once and cannot be recovered.</p>
            <code className="mt-3 block overflow-x-auto rounded-lg bg-black p-3 text-xs text-white">{revealedToken}</code>
            <button type="button" onClick={async () => { await navigator.clipboard.writeText(revealedToken); toast.success("Token copied"); }} className="mt-3 rounded-lg bg-amber-950 px-3 py-2 text-xs font-bold text-white">Copy token</button>
            <button type="button" onClick={() => setRevealedToken(null)} className="ml-2 px-3 py-2 text-xs font-bold text-amber-950">I saved it</button>
          </div>
        )}
        <div className="mt-5 divide-y divide-slate-100">
          {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading tokens…</p> : tokens.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No tokens yet.</p> : tokens.map((token) => (
            <article key={token.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{token.name}</p>{token.revokedAt && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Revoked</span>}</div><p className="mt-1 font-mono text-xs text-slate-500">{token.prefix}</p><p className="mt-1 text-xs text-slate-500">{token.scopes.join(" · ")} · Expires {date(token.expiresAt)} · Last used {date(token.lastUsedAt)}</p></div>
              {!token.revokedAt && <button type="button" onClick={() => void revoke(token)} className="self-start rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Revoke</button>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
