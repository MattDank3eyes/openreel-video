export function resolveViteBase(env: Record<string, string | undefined> = process.env): string {
  if (env.OPENREEL_DESKTOP === "1") return "./";
  const raw = (env.OPENREEL_BASE_PATH || env.VITE_BASE_PATH || "/").trim();
  if (raw === "" || raw === "/") return "/";
  if (raw === "." || raw === "./") return "./";
  let base = raw.startsWith("/") ? raw : `/${raw}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}
