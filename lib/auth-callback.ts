export function safeCallbackPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const base = new URL("https://sheriff.local");
    const resolved = new URL(value, base);
    return resolved.origin === base.origin
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
