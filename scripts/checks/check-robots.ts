import { deepStrictEqual } from "node:assert/strict";

import robots from "../../src/app/robots";

try {
  deepStrictEqual(robots(), {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/profile",
        "/progress",
        "/reading",
        "/listening",
        "/writing",
        "/speaking",
        "/conversation",
      ],
    },
  });
  console.log("ok robots: exact crawler rules, no sitemap or host");
} catch (error) {
  console.error("FAIL robots:", error);
  process.exitCode = 1;
}
