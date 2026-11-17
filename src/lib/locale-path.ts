export function unprefixedPath(pathname: string): string | null {
  if (pathname === "/vi" || pathname === "/en") return "/";
  if (pathname.startsWith("/vi/") || pathname.startsWith("/en/")) {
    return pathname.slice(3);
  }
  return null;
}
