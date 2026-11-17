import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy without nonces: nonces need every page to be
 * dynamically rendered, and this app prerenders static shells (Cache
 * Components). Inline scripts and styles are therefore allowed, but nothing
 * may load from, post to or be framed by another origin.
 *
 * media-src/blob: is the learner's own recording played back in the Speaking
 * recorder; connect-src 'self' covers the auth and transcription routes.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is needed by the Speaking recorder on this origin only.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
  // Browsers ignore this header on plain http, so local demos are unaffected.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Lesson recordings keep their file name when regenerated, so cache for a
      // day (not forever) and let the browser refresh in the background after that.
      {
        source: "/audio/listening/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
  /**
   * Interface language. Pages live under `app/[lang]`; the visible URL never
   * carries the language. Runs after the proxy (so its auth redirects see the
   * plain path) and before the filesystem. API routes, Next's own files, any
   * path with a dot (audio, icons) and paths that already start with a
   * language are left alone, so a rewritten path is never rewritten twice.
   */
  async rewrites() {
    const page = "/:path((?!api(?:/|$)|_next/|vi(?:/|$)|en(?:/|$))[^.]+)";
    const english = [{ type: "cookie" as const, key: "lang", value: "en" }];
    return {
      beforeFiles: [
        { source: "/", has: english, destination: "/en" },
        { source: "/", destination: "/vi" },
        { source: page, has: english, destination: "/en/:path" },
        { source: page, destination: "/vi/:path" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
