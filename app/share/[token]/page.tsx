import { connectDB } from "@/lib/db";
import { File as FileModel } from "@/models/file";
import { formatBytes } from "@/lib/utils";
import Link from "next/link";
import FilePreview from "@/components/file-preview";

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
    deletedAt: null,
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

  const fileExtension = file.originalName.split(".").pop()?.toLowerCase() || "";
  const previewUrl = `/api/files/${file._id.toString()}/preview?token=${token}`;
  const downloadEndpoint = `/api/files/${file._id.toString()}/download?token=${token}&redirect=true`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-gray-200 text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-50 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white font-extrabold text-xl shadow-md">
            S
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-gray-900">
            Secure Payload
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Verify details safely below before saving to your device.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left flex gap-3 items-start">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
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
            <div>
              <h4 className="text-xs font-bold text-amber-900">Safety Check</h4>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Ensure you know the sender. Verify the filename, extension, and
                preview match your expectations before executing or installing
                anything.
              </p>
            </div>
          </div>

          <div className="my-6 rounded-2xl bg-gray-50 p-4 border border-gray-200 text-left shadow-inner">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-200 text-gray-800 font-bold uppercase text-[10px]">
                {fileExtension || "FILE"}
              </div>
              <div className="overflow-hidden w-full">
                <h3
                  className="font-bold text-gray-900 truncate"
                  title={file.originalName}
                >
                  {file.originalName}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  <p>
                    Size:{" "}
                    <span className="font-semibold text-gray-700">
                      {formatBytes(file.size)}
                    </span>
                  </p>
                  <p>•</p>
                  <p>
                    Type:{" "}
                    <span className="font-semibold text-gray-700 uppercase">
                      {fileExtension}
                    </span>
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Shared on: {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="mb-6 border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
            <div className="bg-gray-100/80 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Secure File Preview
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Safe Mode
              </span>
            </div>

            <div className="p-4 flex items-center justify-center min-h-[160px] max-h-[320px] overflow-y-auto">
              <FilePreview
                previewUrl={previewUrl}
                originalName={file.originalName}
                fileExtension={fileExtension}
              />
            </div>
          </div>

          <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 mb-6">
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

      <div className="mt-8 w-full max-w-lg">
        <div className="rounded-3xl bg-gradient-to-br from-gray-900 to-black p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
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
