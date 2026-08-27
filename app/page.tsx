import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  const uploadActionUrl = isLoggedIn
    ? "/dashboard?upload=true"
    : "/login?callbackUrl=%2Fdashboard%3Fupload%3Dtrue";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 text-gray-900 flex flex-col">
      <header className="relative z-40 border-b border-gray-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-black font-extrabold text-white text-base sm:text-lg shadow-md">
              S
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
              Sheriff
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-black px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-30 overflow-hidden min-h-[500px] md:min-h-[600px] flex items-center">
        <AnimatedPathBackground />

        <div className="relative z-20 flex flex-col items-center justify-center px-4 sm:px-6 py-12 md:py-20 mx-auto w-full">
          <div className="text-center max-w-3xl w-full">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 backdrop-blur px-3.5 py-1 text-[10px] sm:text-xs font-semibold text-gray-700 shadow-sm mb-6">
              <span className="text-sm leading-none">⭐</span>
              There&apos;s a new Sheriff in town.
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900">
              Ultra-Fast, Secure Storage
            </h1>
            <p className="mt-3 md:mt-4 text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-500 to-red-500">
              Transfer your files anywhere, anytime with Sheriff.
            </p>

            <p className="mx-auto mt-3 md:mt-4 max-w-xl text-sm md:text-base text-gray-600 leading-relaxed px-4 sm:px-0">
              Lock down your payloads with industry-grade client protection and
              deliver them safely across the web at lightning speed.
            </p>

            <div className="mt-8 mx-auto max-w-md w-full px-2 sm:px-0">
              <Link
                href={uploadActionUrl}
                className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white/90 backdrop-blur-md p-6 sm:p-8 text-center shadow-lg transition-all hover:border-black hover:bg-white cursor-pointer block"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600 group-hover:scale-110 group-hover:bg-black group-hover:text-white transition duration-300 mx-auto">
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

                <h3 className="mt-4 text-sm font-bold text-gray-950">
                  Click here to start uploading files
                </h3>
                <p className="mt-1 text-xs text-gray-500 hidden sm:block">
                  Direct browser transfer stream with live progressive tracking
                </p>

                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black group-hover:bg-black group-hover:text-white transition">
                  Secure File Vault
                </div>
              </Link>
            </div>

            <p className="mt-8 text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 font-semibold">
              Fast Draw · Iron-Clad Security · Zero Compromises
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-30 px-4 sm:px-6 pb-16 md:pb-20 pt-4 bg-gradient-to-b from-transparent to-gray-50/80">
        <div className="mx-auto w-full max-w-4xl">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              How Sheriff works
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-lg mx-auto">
              Three simple steps. Upload once. Share securely. Download at full
              speed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-black text-white text-sm font-bold shadow-sm">
                1
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">Upload</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Drop any file into Sheriff. Big files stream straight from your
                browser — no slow middle hop, no stalled progress bar.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-black text-white text-sm font-bold shadow-sm">
                2
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">Share</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Flip a file to public and copy a secure link. Only people with
                that link can open it. Flip it private anytime to lock it again.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-black text-white text-sm font-bold shadow-sm">
                3
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">
                Download
              </h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Recipients hit one button and the file streams straight to them.
                Fast, private, and fully under your control.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 text-center">
              Why Sheriff transfers feel faster
            </h3>
            <p className="mt-2 text-sm text-gray-500 text-center max-w-xl mx-auto">
              Most file apps bounce your data through slow servers. Sheriff
              takes the direct path — so uploads and downloads finish sooner.
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Lightning upload speed
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
                    Files leave your device and land in secure storage on a
                    direct path. No waiting on a middle server to receive then
                    forward your payload.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
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
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Instant download delivery
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
                    When someone clicks download, the file streams straight to
                    them. Fewer hops means higher speed and fewer failed
                    transfers.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Live progress, full control
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
                    Watch every upload move from 0% to 100% in real time. Cancel
                    anytime. Built for everyday files and 100MB+ payloads.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Private by default
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
                    Every file starts locked. You choose who gets a share link —
                    and you can revoke access instantly by making it private
                    again.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={uploadActionUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-gray-800 transition shadow-sm"
              >
                Start uploading now
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Create a free account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-40 border-t border-gray-200/60 bg-white/70 backdrop-blur-md py-6 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} Sheriff. Ride safe, partner.</p>
      </footer>
    </div>
  );
}

function AnimatedPathBackground() {
  return (
    <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
      <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] md:h-[600px] md:w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-100/60 via-orange-50/40 to-transparent blur-3xl" />

      {/* Mobile/Tablet Layout (<1024px) */}
      <div className="block lg:hidden absolute inset-0 w-full h-full">
        <svg
          viewBox="0 0 375 660"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full"
        >
          <defs>
            <path id="mobArcLeft" d="M 0,80 A 100,100 0 0,1 0,280" />
            <path id="mobArcRight" d="M 375,200 A 75,75 0 0,0 375,350" />
            <path
              id="mobAcross"
              d="M -30,520 C 80,440 180,410 210,450 C 240,490 290,510 405,470"
            />
          </defs>

          <path
            d="M 0,80 A 100,100 0 0,1 0,280"
            stroke="currentColor"
            className="text-gray-300/60"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            fill="none"
          />
          <path
            d="M 375,200 A 75,75 0 0,0 375,350"
            stroke="currentColor"
            className="text-gray-300/60"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            fill="none"
          />
          <path
            d="M -30,520 C 80,440 180,410 210,450 C 240,490 290,510 405,470"
            stroke="currentColor"
            className="text-gray-300/60"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            fill="none"
          />

          <g>
            <animateMotion dur="28s" repeatCount="indefinite" begin="0s">
              <mpath href="#mobArcLeft" />
            </animateMotion>
            <foreignObject
              x="-20"
              y="-20"
              width="40"
              height="40"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border shadow-sm backdrop-blur-md rounded-xl bg-red-50 text-red-600 border-red-200 h-9 w-9 text-[8px]">
                <FileIcon />
                <span className="leading-none mt-0.5 scale-90">PDF</span>
              </div>
            </foreignObject>
          </g>

          <g>
            <animateMotion dur="26s" repeatCount="indefinite" begin="0s">
              <mpath href="#mobArcRight" />
            </animateMotion>
            <foreignObject
              x="-20"
              y="-20"
              width="40"
              height="40"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border shadow-sm backdrop-blur-md rounded-xl bg-blue-50 text-blue-600 border-blue-200 h-9 w-9 text-[8px]">
                <FileIcon />
                <span className="leading-none mt-0.5 scale-90">PNG</span>
              </div>
            </foreignObject>
          </g>

          <g>
            <animateMotion dur="38s" repeatCount="indefinite" begin="0s">
              <mpath href="#mobAcross" />
            </animateMotion>
            <foreignObject
              x="-20"
              y="-20"
              width="40"
              height="40"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border shadow-sm backdrop-blur-md rounded-xl bg-emerald-50 text-emerald-600 border-emerald-200 h-9 w-9 text-[8px]">
                <FileIcon />
                <span className="leading-none mt-0.5 scale-90">TXT</span>
              </div>
            </foreignObject>
          </g>
          <g>
            <animateMotion dur="38s" repeatCount="indefinite" begin="-19s">
              <mpath href="#mobAcross" />
            </animateMotion>
            <foreignObject
              x="-20"
              y="-20"
              width="40"
              height="40"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border shadow-sm backdrop-blur-md rounded-xl bg-orange-50 text-orange-600 border-orange-200 h-9 w-9 text-[8px]">
                <FileIcon />
                <span className="leading-none mt-0.5 scale-90">JPG</span>
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>

      {/* Desktop Layout (>=1024px) */}
      <div className="hidden lg:block absolute inset-0 w-full h-full">
        <svg
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full"
        >
          <defs>
            <path id="arcLeft" d="M 0,120 A 420,420 0 0,1 0,960" />
            <path id="arcRightTop" d="M 1920,80 A 220,220 0 0,0 1920,520" />
            <path id="arcRightBottom" d="M 1920,560 A 200,200 0 0,0 1920,960" />
            <path
              id="acrossDoodle"
              d="M -40,820 C 240,640 480,600 720,660 C 960,720 960,880 1200,860 C 1420,840 1660,700 1960,780"
            />
          </defs>

          <path
            d="M 0,120 A 420,420 0 0,1 0,960"
            stroke="currentColor"
            className="text-gray-300/70"
            strokeWidth="2.5"
            strokeDasharray="8 8"
            fill="none"
          />
          <path
            d="M 1920,80 A 220,220 0 0,0 1920,520"
            stroke="currentColor"
            className="text-gray-300/70"
            strokeWidth="2.5"
            strokeDasharray="8 8"
            fill="none"
          />
          <path
            d="M 1920,560 A 200,200 0 0,0 1920,960"
            stroke="currentColor"
            className="text-gray-300/70"
            strokeWidth="2.5"
            strokeDasharray="8 8"
            fill="none"
          />
          <path
            d="M -40,820 C 240,640 480,600 720,660 C 960,720 960,880 1200,860 C 1420,840 1660,700 1960,780"
            stroke="currentColor"
            className="text-gray-300/70"
            strokeWidth="2.5"
            strokeDasharray="8 8"
            fill="none"
            strokeLinecap="round"
          />

          <g>
            <animateMotion
              dur="32s"
              repeatCount="indefinite"
              begin="0s"
              rotate="auto-reverse"
            >
              <mpath href="#arcLeft" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-2xl bg-red-50 text-red-600 border-red-300 h-12 w-12 text-[10px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">PDF</span>
              </div>
            </foreignObject>
          </g>
          <g>
            <animateMotion
              dur="32s"
              repeatCount="indefinite"
              begin="-11s"
              rotate="auto-reverse"
            >
              <mpath href="#arcLeft" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-full bg-amber-50 text-amber-700 border-amber-300 h-14 w-14 text-[11px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">ZIP</span>
              </div>
            </foreignObject>
          </g>
          <g>
            <animateMotion
              dur="32s"
              repeatCount="indefinite"
              begin="-22s"
              rotate="auto-reverse"
            >
              <mpath href="#arcLeft" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-full bg-purple-50 text-purple-600 border-purple-300 h-11 w-11 text-[9px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">MP4</span>
              </div>
            </foreignObject>
          </g>

          <g>
            <animateMotion
              dur="26s"
              repeatCount="indefinite"
              begin="0s"
              rotate="auto-reverse"
            >
              <mpath href="#arcRightTop" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-2xl bg-blue-50 text-blue-600 border-blue-300 h-11 w-11 text-[9px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">PNG</span>
              </div>
            </foreignObject>
          </g>
          <g>
            <animateMotion
              dur="26s"
              repeatCount="indefinite"
              begin="-13s"
              rotate="auto-reverse"
            >
              <mpath href="#arcRightTop" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-2xl bg-pink-50 text-pink-600 border-pink-300 h-10 w-10 text-[9px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">SVG</span>
              </div>
            </foreignObject>
          </g>

          <g>
            <animateMotion
              dur="24s"
              repeatCount="indefinite"
              begin="-4s"
              rotate="auto-reverse"
            >
              <mpath href="#arcRightBottom" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-2xl bg-sky-50 text-sky-600 border-sky-300 h-12 w-12 text-[10px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">DOC</span>
              </div>
            </foreignObject>
          </g>
          <g>
            <animateMotion
              dur="24s"
              repeatCount="indefinite"
              begin="-16s"
              rotate="auto-reverse"
            >
              <mpath href="#arcRightBottom" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-full bg-indigo-50 text-indigo-600 border-indigo-300 h-10 w-10 text-[9px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">MP3</span>
              </div>
            </foreignObject>
          </g>

          <g>
            <animateMotion
              dur="42s"
              repeatCount="indefinite"
              begin="0s"
              rotate="auto-reverse"
            >
              <mpath href="#acrossDoodle" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-2xl bg-emerald-50 text-emerald-600 border-emerald-300 h-11 w-11 text-[9px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">TXT</span>
              </div>
            </foreignObject>
          </g>
          <g>
            <animateMotion
              dur="42s"
              repeatCount="indefinite"
              begin="-21s"
              rotate="auto-reverse"
            >
              <mpath href="#acrossDoodle" />
            </animateMotion>
            <foreignObject
              x="-40"
              y="-40"
              width="80"
              height="80"
              className="overflow-visible"
            >
              <div className="flex flex-col items-center justify-center font-extrabold border-2 shadow-md backdrop-blur-md rounded-2xl bg-orange-50 text-orange-600 border-orange-300 h-11 w-11 text-[9px]">
                <FileIcon />
                <span className="mt-0.5 tracking-wider leading-none">JPG</span>
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 md:w-5 md:h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
