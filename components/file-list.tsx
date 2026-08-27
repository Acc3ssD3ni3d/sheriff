"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import { IFile } from "@/types";

interface FileListProps {
  files: IFile[];
  onFilesChange: (files: IFile[]) => void;
  onSoftRefresh: () => void;
  mode?: "files" | "trash";
}

export function FileList({
  files,
  onFilesChange,
  onSoftRefresh,
  mode = "files",
}: FileListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<IFile | null>(null);
  const [newName, setNewName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [sharingFile, setSharingFile] = useState<IFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isTrash = mode === "trash";

  const handleDownload = async (file: IFile) => {
    try {
      setDownloadingId(file._id);
      const res = await fetch(`/api/files/${file._id}/download`);
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || "Failed");

      const link = document.createElement("a");
      link.href = data.data.downloadUrl;
      link.download = data.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleVisibility = async (file: IFile) => {
    if (togglingId) return;

    const nextVisibility = file.visibility === "public" ? "private" : "public";
    const previousFiles = files;

    onFilesChange(
      files.map((f) =>
        f._id === file._id
          ? {
              ...f,
              visibility: nextVisibility as "public" | "private",
              shareToken: nextVisibility === "private" ? null : f.shareToken,
            }
          : f,
      ),
    );
    setTogglingId(file._id);

    try {
      const res = await fetch(`/api/files/${file._id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: nextVisibility }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      onFilesChange(
        files.map((f) =>
          f._id === file._id
            ? {
                ...f,
                visibility: data.data.visibility,
                shareToken: data.data.shareToken ?? null,
              }
            : f,
        ),
      );

      toast.success(`File is now ${nextVisibility}`);
    } catch (error: unknown) {
      onFilesChange(previousFiles);
      toast.error(error instanceof Error ? error.message : "Toggle failed");
    } finally {
      setTogglingId(null);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !newName.trim()) return;

    setIsProcessing(true);
    const previousFiles = files;
    const trimmed = newName.trim();

    onFilesChange(
      files.map((f) =>
        f._id === renamingFile._id ? { ...f, originalName: trimmed } : f,
      ),
    );

    try {
      const res = await fetch(`/api/files/${renamingFile._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success("Renamed");
      setRenamingFile(null);
    } catch (error: unknown) {
      onFilesChange(previousFiles);
      toast.error(error instanceof Error ? error.message : "Rename failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    setIsProcessing(true);
    const previousFiles = files;

    onFilesChange(files.filter((f) => f._id !== deletingId));
    const toDelete = deletingId;
    const isPermanent = permanentDelete;
    setDeletingId(null);
    setPermanentDelete(false);

    try {
      const url = isPermanent
        ? `/api/files/${toDelete}?permanent=true`
        : `/api/files/${toDelete}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success(
        isPermanent ? "File permanently deleted" : "Moved to Trash",
      );
    } catch (error: unknown) {
      onFilesChange(previousFiles);
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (file: IFile) => {
    const previousFiles = files;
    onFilesChange(files.filter((f) => f._id !== file._id));

    try {
      const res = await fetch(`/api/files/${file._id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success("File restored");
      onSoftRefresh();
    } catch (error: unknown) {
      onFilesChange(previousFiles);
      toast.error(error instanceof Error ? error.message : "Restore failed");
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 sm:p-16 text-center shadow-sm">
        <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gray-50 text-gray-400 mb-4">
          <span className="text-2xl sm:text-3xl">{isTrash ? "🗑️" : "📁"}</span>
        </div>
        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900">
          {isTrash ? "Trash is empty" : "Your vault is empty"}
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-gray-500 max-w-sm px-4">
          {isTrash
            ? "Deleted files will appear here for 7 days before being permanently removed."
            : "Start uploading files. They'll appear here."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* ── 1. MOBILE CARDS VIEW (< sm) ── */}
        <div className="block sm:hidden divide-y divide-gray-100">
          {files.map((file) => {
            const isPublic = file.visibility === "public";
            const isToggling = togglingId === file._id;
            const displayDate = isTrash ? file.deletedAt : file.createdAt;

            return (
              <div key={file._id} className="p-4 space-y-3">
                {/* Top Row: Icon + Name + Primary Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 border border-gray-200">
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
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-bold text-gray-900 truncate"
                        title={file.originalName}
                      >
                        {file.originalName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatBytes(file.size)} •{" "}
                        {displayDate
                          ? new Date(displayDate).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Visibility Switch + Action Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                  {/* Visibility */}
                  {!isTrash ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleVisibility(file)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          isPublic ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                            isPublic ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span
                        className={`text-xs font-bold ${isPublic ? "text-emerald-600" : "text-gray-500"}`}
                      >
                        {isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-1">
                    {isTrash ? (
                      <>
                        <button
                          onClick={() => handleRestore(file)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setDeletingId(file._id);
                            setPermanentDelete(true);
                          }}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        {isPublic && file.shareToken && (
                          <button
                            onClick={() => setSharingFile(file)}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloadingId === file._id}
                          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setRenamingFile(file);
                            setNewName(file.originalName);
                          }}
                          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setDeletingId(file._id);
                            setPermanentDelete(false);
                          }}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 2. DESKTOP & TABLET TABLE VIEW (>= sm) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">File Name</th>
                <th className="px-6 py-4">Size</th>
                {!isTrash && <th className="px-6 py-4">Visibility</th>}
                <th className="px-6 py-4">
                  {isTrash ? "Deleted" : "Uploaded"}
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((file) => {
                const isPublic = file.visibility === "public";
                const isToggling = togglingId === file._id;
                const displayDate = isTrash ? file.deletedAt : file.createdAt;

                return (
                  <tr
                    key={file._id}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 border border-gray-200">
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
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <span
                          className="truncate max-w-xs block"
                          title={file.originalName}
                        >
                          {file.originalName}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-600">
                      {formatBytes(file.size)}
                    </td>

                    {!isTrash && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleVisibility(file)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60 disabled:cursor-wait ${
                              isPublic ? "bg-emerald-500" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                                isPublic ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-bold ${isPublic ? "text-emerald-600" : "text-gray-500"}`}
                          >
                            {isPublic ? "Public" : "Private"}
                          </span>
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs font-semibold">
                      {displayDate
                        ? new Date(displayDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        {isTrash ? (
                          <>
                            <button
                              onClick={() => handleRestore(file)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                              title="Restore"
                            >
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
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setDeletingId(file._id);
                                setPermanentDelete(true);
                              }}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Delete Permanently"
                            >
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            {isPublic && file.shareToken && (
                              <button
                                onClick={() => setSharingFile(file)}
                                className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title="Share"
                              >
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
                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                  />
                                </svg>
                              </button>
                            )}

                            <button
                              onClick={() => handleDownload(file)}
                              disabled={downloadingId === file._id}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-black transition-colors disabled:opacity-30"
                              title="Download"
                            >
                              {downloadingId === file._id ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
                              ) : (
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
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setRenamingFile(file);
                                setNewName(file.originalName);
                              }}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-black transition-colors"
                              title="Rename"
                            >
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
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </button>

                            <button
                              onClick={() => {
                                setDeletingId(file._id);
                                setPermanentDelete(false);
                              }}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Move to Trash"
                            >
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isTrash && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 sm:px-6 py-3">
            <p className="text-xs text-gray-500">
              🕐 Files are kept securely in your vault. Trashed items are
              deleted after{" "}
              <span className="font-bold text-gray-700">7 days</span>.
            </p>
          </div>
        )}
      </div>

      {/* Share Dialog */}
      {sharingFile && sharingFile.shareToken && (
        <ShareDialog file={sharingFile} onClose={() => setSharingFile(null)} />
      )}

      {/* Rename Modal */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">
              Rename File
            </h3>
            <form
              onSubmit={handleRenameSubmit}
              className="mt-4 sm:mt-5 space-y-4 sm:space-y-5"
            >
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-gray-300 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
              <div className="flex justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setRenamingFile(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !newName.trim()}
                  className="rounded-xl bg-black px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {isProcessing ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-gray-100">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3 sm:mb-4">
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">
              {permanentDelete ? "Delete Permanently?" : "Move to Trash?"}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
              {permanentDelete
                ? "This file will be permanently deleted from storage. This action cannot be undone."
                : "This file will be moved to Trash and automatically deleted after 7 days. You can restore it before then."}
            </p>
            <div className="mt-6 sm:mt-8 flex justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingId(null);
                  setPermanentDelete(false);
                }}
                className="rounded-xl border border-gray-300 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isProcessing}
                className="rounded-xl bg-red-600 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing
                  ? "Working..."
                  : permanentDelete
                    ? "Delete Forever"
                    : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Share Dialog with Social Buttons ── */
function ShareDialog({ file, onClose }: { file: IFile; onClose: () => void }) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${file.shareToken}`
      : "";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(
    `Check out this file: ${file.originalName}`,
  );

  const socials = [
    {
      name: "WhatsApp",
      color: "bg-green-500 hover:bg-green-600",
      url: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      name: "Twitter",
      color: "bg-sky-500 hover:bg-sky-600",
      url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      name: "Telegram",
      color: "bg-blue-500 hover:bg-blue-600",
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      name: "Facebook",
      color: "bg-blue-700 hover:bg-blue-800",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "LinkedIn",
      color: "bg-sky-700 hover:bg-sky-800",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "Email",
      color: "bg-gray-700 hover:bg-gray-800",
      url: `mailto:?subject=${encodedText}&body=${encodedUrl}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            Share File
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg sm:text-xl"
          >
            ✕
          </button>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 truncate mb-4 sm:mb-5">
          {file.originalName}
        </p>

        {/* Copy Link */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5 sm:p-2 mb-4 sm:mb-5">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-gray-700 outline-none truncate"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success("Link copied!");
            }}
            className="rounded-lg bg-black px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold text-white hover:bg-gray-800 transition"
          >
            Copy
          </button>
        </div>

        {/* Social Grid */}
        <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">
          Share via
        </p>
        <div className="grid grid-cols-3 gap-2">
          {socials.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${s.color} rounded-xl px-2 py-2 sm:px-3 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-white transition-all hover:scale-105 shadow-sm`}
            >
              {s.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
