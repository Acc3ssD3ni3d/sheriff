"use client";

import { useState } from "react";

interface FilePreviewProps {
  previewUrl: string;
  originalName: string;
  fileExtension: string;
}

export default function FilePreview({
  previewUrl,
  originalName,
  fileExtension,
}: FilePreviewProps) {
  const [hasError, setHasError] = useState(false);

  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(
    fileExtension,
  );
  const isPdf = fileExtension === "pdf";
  const isVideo = ["mp4", "webm", "ogg", "mov", "m4v"].includes(fileExtension);
  const isAudio = ["mp3", "wav", "ogg", "m4a", "aac"].includes(fileExtension);

  if (hasError || (!isImage && !isPdf && !isVideo && !isAudio)) {
    return (
      <div className="text-center p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 mb-3">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-xs font-bold text-gray-800">
          Direct Preview Unavailable
        </p>
        <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
          Inline preview for{" "}
          <span className="uppercase font-semibold">
            {fileExtension || "this file"}
          </span>{" "}
          is restricted by storage safety settings. Click download below to view
          securely.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={originalName}
          onError={() => setHasError(true)}
          className="max-w-full max-h-[280px] rounded-lg object-contain shadow-sm border border-gray-200"
        />
      )}

      {isVideo && (
        <video
          src={previewUrl}
          controls
          preload="metadata"
          onError={() => setHasError(true)}
          className="w-full max-h-[280px] rounded-lg border border-gray-200 bg-black"
        >
          Your browser does not support inline video preview.
        </video>
      )}

      {isAudio && (
        <div className="w-full py-6 px-4 flex flex-col items-center">
          <svg
            className="w-10 h-10 text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <audio
            src={previewUrl}
            controls
            preload="metadata"
            onError={() => setHasError(true)}
            className="w-full max-w-sm"
          />
        </div>
      )}

      {isPdf && (
        <iframe
          src={`${previewUrl}#toolbar=0`}
          onError={() => setHasError(true)}
          className="w-full h-[280px] rounded-lg border border-gray-200"
          title="PDF Preview"
        />
      )}
    </div>
  );
}
