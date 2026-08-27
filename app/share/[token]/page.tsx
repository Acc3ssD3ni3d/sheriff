import { connectDB } from "@/lib/db";
import { File as FileModel } from "@/models/file";
import { formatBytes } from "@/lib/utils";
import Link from "next/link";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;

  await connectDB();
  const file = await FileModel.findOne({
    shareToken: token,
    visibility: "public",
    status: "completed",
    deletedAt: null, // Ensure trashed files cannot be downloaded
  }).lean();

  if (!file) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-gray-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="w-7 h-7"
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
          <h2 className="mt-4 text-xl font-bold text-gray-900">
            Link Expired or Invalid
          </h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            This shared file is either private, deleted, or the link is invalid.
            The owner may have revoked access.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-800 transition shadow-sm"
          >
            Go to Sheriff Home
          </Link>
        </div>
      </div>
    );
  }

  // Uses direct 302 redirect straight to secure storage
  const downloadEndpoint = `/api/files/${file._id.toString()}/download?token=${token}&redirect=true`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-12">
      {/* ── Main Download Card ── */}
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-gray-200 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-50 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white font-extrabold text-xl shadow-md">
            S
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-gray-900">
            Secure Payload
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Someone shared a file with you via Sheriff.
          </p>

          {/* File Card info */}
          <div className="my-8 rounded-2xl bg-gray-50 p-5 border border-gray-200 text-left shadow-inner">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-200 text-gray-800">
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
              <div className="overflow-hidden">
                <h3
                  className="font-bold text-gray-900 truncate"
                  title={file.originalName}
                >
                  {file.originalName}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Size:{" "}
                  <span className="font-semibold text-gray-700">
                    {formatBytes(file.size)}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Shared on: {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Instructions & Trigger */}
          <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 mb-6">
            <p className="text-xs font-semibold text-gray-600 mb-3">
              👇 Click below to save this file to your device.
            </p>
            <a
              href={downloadEndpoint}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3.5 px-4 text-sm font-bold text-white shadow-md hover:shadow-lg hover:bg-gray-800 hover:scale-[1.01] transition-all"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Securely
            </a>
          </div>

          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Encrypted delivery · Access controlled by owner
          </p>
        </div>
      </div>

      {/* ── Sheriff Promo Banner ── */}
      <div className="mt-8 w-full max-w-lg">
        <div className="rounded-3xl bg-gradient-to-br from-gray-900 to-black p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10">
            <h3 className="text-lg font-extrabold text-white">
              Want to send files like this?
            </h3>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
              Stop fighting with email limits and slow transfers. Use Sheriff to
              send massive files instantly and securely for free.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-black hover:bg-gray-100 transition shadow-sm"
              >
                Try Sheriff for Free
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-gray-600 bg-transparent px-6 py-2.5 text-sm font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-xs font-semibold text-gray-400">
        <p>© {new Date().getFullYear()} Sheriff. Ride safe, partner.</p>
      </footer>
    </div>
  );
}
