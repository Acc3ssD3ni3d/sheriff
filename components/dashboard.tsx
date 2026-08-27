"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadDialog } from "./upload-dialog";
import { FileList } from "./file-list";
import { IFile } from "@/types";
import { formatBytes } from "@/lib/utils";

interface DashboardProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

type View = "files" | "trash";

export function Dashboard({ user }: DashboardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [view, setView] = useState<View>("files");
  const [files, setFiles] = useState<IFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userBytesUsed, setUserBytesUsed] = useState(0);
  const [userStorageLimit, setUserStorageLimit] = useState(
    10 * 1024 * 1024 * 1024,
  );

  const autoUpload = searchParams.get("upload") === "true";
  const isModalOpen = isUploadOpen || autoUpload;

  const handleCloseUpload = () => {
    setIsUploadOpen(false);
    if (autoUpload) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("upload");
      const newQuery = params.toString();
      router.replace(`/dashboard${newQuery ? `?${newQuery}` : ""}`, {
        scroll: false,
      });
    }
  };

  const handleSoftRefresh = () => setRefreshTrigger((prev) => prev + 1);

  const handleProClick = () => {
    toast("🚀 Pro plan is coming soon!", {
      description: "Lifetime access, no expiry. Stay tuned!",
    });
  };

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        const endpoint =
          view === "trash"
            ? "/api/files/trash"
            : `/api/files?${new URLSearchParams({
                search,
                sortBy,
                order,
              }).toString()}`;

        const res = await fetch(endpoint, { signal: controller.signal });
        const data = await res.json();

        if (res.ok && data.success) {
          setFiles(data.data);
          if (data.stats) {
            setUserBytesUsed(data.stats.userBytesUsed);
            setUserStorageLimit(data.stats.userStorageLimit);
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Fetch error:", error);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [search, sortBy, order, refreshTrigger, view]);

  const usagePercent = Math.min(
    100,
    Math.max(1, Math.round((userBytesUsed / userStorageLimit) * 100)),
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        } ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black font-extrabold text-white text-lg shadow-sm">
              S
            </div>
            {!sidebarCollapsed && (
              <span className="text-lg font-bold tracking-tight text-gray-900">
                Sheriff
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarButton
            active={view === "files"}
            collapsed={sidebarCollapsed}
            onClick={() => {
              setView("files");
              setSidebarOpen(false);
            }}
            label="My Files"
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            }
          />

          <SidebarButton
            active={view === "trash"}
            collapsed={sidebarCollapsed}
            onClick={() => {
              setView("trash");
              setSidebarOpen(false);
            }}
            label="Trash"
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            }
          />

          {!sidebarCollapsed && (
            <div className="pt-6 pb-2 px-2">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                Storage
              </p>
            </div>
          )}

          {/* Storage widget */}
          {!sidebarCollapsed && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-700">Free Plan</p>
                <p className="text-xs font-semibold text-gray-500">
                  {usagePercent}%
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full transition-all ${
                    usagePercent > 80 ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                <span className="font-bold text-gray-800">
                  {formatBytes(userBytesUsed)}
                </span>{" "}
                of 10 GB
              </p>
            </div>
          )}

          {/* Pro banner */}
          {!sidebarCollapsed && (
            <button
              onClick={handleProClick}
              className="mt-4 w-full text-left rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-4 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚡</span>
                <p className="text-sm font-extrabold">Go Pro</p>
              </div>
              <p className="text-xs text-white/90 leading-snug">
                Upload 1GB+ files. Lifetime access, no expiry.
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider bg-white/20 rounded-full px-2 py-1 inline-block">
                Coming Soon
              </p>
            </button>
          )}
        </nav>

        {/* Profile & Sign Out Bottom Section */}
        <div className="border-t border-gray-200 bg-gray-50/50 p-4 shrink-0">
          <div
            className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} mb-4`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-800 to-black text-white font-bold text-sm">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={`flex items-center justify-center w-full gap-2 rounded-lg border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100 transition-all ${sidebarCollapsed ? "px-0" : "px-3"}`}
            title="Sign Out"
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Desktop Collapse toggle */}
        <div className="border-t border-gray-200 p-2 hidden lg:block">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center justify-center w-full rounded-lg bg-gray-50 hover:bg-gray-100 py-2 text-gray-500 transition-colors"
            title={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            <svg
              className={`w-5 h-5 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}
      >
        {/* Top Header (Mobile Only) */}
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-700 hover:text-black"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black font-extrabold text-white text-xs">
                S
              </div>
              <span className="font-bold text-gray-900">Sheriff</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {view === "files" && (
            <>
              {/* Stats + Simple Upload Card (Mobile: grid-cols-2 side-by-side) */}
              <div className="mb-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* 1. Upload Card (Full width on mobile, top order) */}
                <div className="col-span-2 md:col-span-1 order-1 md:order-3 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="group flex h-full w-full flex-col items-center justify-center p-5 rounded-2xl bg-gray-50/50 hover:bg-gray-50 border-2 border-dashed border-transparent hover:border-black transition-all min-h-[140px]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      Upload New File
                    </p>
                  </button>
                </div>

                {/* 2. Total Files (Half width on mobile) */}
                <div className="col-span-1 md:col-span-1 order-2 md:order-1 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 tracking-wide">
                    Total Files
                  </p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                    {files.length}
                  </p>
                </div>

                {/* 3. Storage Used (Half width on mobile) */}
                <div className="col-span-1 md:col-span-1 order-3 md:order-2 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 tracking-wide">
                    Your Storage
                  </p>
                  <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 truncate">
                    {formatBytes(userBytesUsed)}
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                    of 10 GB used
                  </p>
                </div>
              </div>

              {/* Search + Sort */}
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-2 sm:p-3 border border-gray-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search payloads by name..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setIsLoading(true);
                    }}
                    className="block w-full rounded-lg border-none bg-gray-50 py-2.5 pl-11 pr-4 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-black transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setIsLoading(true);
                    }}
                    className="flex-1 sm:flex-none rounded-lg border-none bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 focus:ring-2 focus:ring-black transition-all"
                  >
                    <option value="createdAt">Date Uploaded</option>
                    <option value="originalName">Filename</option>
                    <option value="size">File Size</option>
                  </select>

                  <button
                    onClick={() => {
                      setOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                      setIsLoading(true);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-black transition-all"
                    title="Toggle sort direction"
                  >
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 ${order === "asc" ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
                <p className="text-sm font-bold text-gray-400">
                  Loading vault...
                </p>
              </div>
            </div>
          ) : (
            <FileList
              files={files}
              onFilesChange={setFiles}
              onSoftRefresh={handleSoftRefresh}
              mode={view}
            />
          )}
        </main>
      </div>

      <UploadDialog
        isOpen={isModalOpen}
        onClose={handleCloseUpload}
        onUploadSuccess={handleSoftRefresh}
      />
    </div>
  );
}

/* ── Sidebar Button Helper ── */
function SidebarButton({
  active,
  collapsed,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "bg-black text-white shadow-sm"
          : "text-gray-700 hover:bg-gray-100"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? label : undefined}
    >
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {icon}
      </svg>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
