"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadDialog({
  isOpen,
  onClose,
  onUploadSuccess,
}: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploading) return;
    setSelectedFile(null);
    setProgress(0);
    setIsUploading(false);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setIsUploading(false);
    setProgress(0);
    setSelectedFile(null);
    toast.info("Upload cancelled");
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setProgress(0);

    let fileId = "";

    try {
      // 1. Request presigned PUT URL from Next.js API
      const initRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          size: selectedFile.size,
        }),
      });

      const initData = await initRes.json();

      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error || "Failed to initialize upload");
      }

      const { uploadUrl, fileId: createdFileId } = initData.data;
      fileId = createdFileId;

      // 2. Direct upload to Cloudflare R2 using XMLHttpRequest for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100,
            );
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(`Storage rejected upload with status ${xhr.status}`),
            );
          }
        };

        xhr.onerror = () =>
          reject(new Error("Network connection error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));

        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader(
          "Content-Type",
          selectedFile.type || "application/octet-stream",
        );
        xhr.send(selectedFile);
      });

      // 3. Confirm completed status in MongoDB
      const confirmRes = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (!confirmRes.ok) {
        throw new Error("Failed to confirm file record");
      }

      toast.success(`${selectedFile.name} uploaded successfully!`);
      setSelectedFile(null);
      setProgress(0);
      setIsUploading(false);
      onUploadSuccess();
      onClose();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.";

      if (errorMessage !== "Upload aborted") {
        toast.error(errorMessage);

        // Mark as failed in DB if file record was initialized
        if (fileId) {
          fetch(`/api/files/${fileId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "failed" }),
          }).catch(console.error);
        }
      }
    } finally {
      setIsUploading(false);
      xhrRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-lg font-bold text-gray-900">Upload File</h3>
          {!isUploading && (
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Drag and drop box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
            isDragging
              ? "border-black bg-gray-50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
          } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-700">
            Click to browse or drag & drop file here
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Supports 100MB+ files (Direct upload to storage)
          </p>
        </div>

        {/* Selected file info */}
        {selectedFile && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="truncate pr-4">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Progress bar */}
            {isUploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-medium text-gray-600">
                  <span>Uploading directly to storage...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-black transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal actions */}
        <div className="mt-6 flex justify-end gap-3">
          {isUploading ? (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
            >
              Cancel Upload
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={!selectedFile}
                className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition"
              >
                Start Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
