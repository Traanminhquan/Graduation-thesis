/** Offline header contract guard: npx tsx scripts/check-header-layout.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { commonMessages } from "../src/i18n/messages/common";
import { navigation } from "../src/lib/site";

assert.deepEqual(navigation, [
  { key: "reading", href: "/reading" },
  { key: "listening", href: "/listening" },
  { key: "writing", href: "/writing" },
  { key: "speaking", href: "/speaking" },
  { key: "conversation", href: "/conversation" },
  { key: "progress", href: "/progress" },
]);
for (const locale of ["en", "vi"] as const) {
  for (const item of navigation) assert.ok(commonMessages[locale].nav[item.key], `${locale}: label for ${item.key}`);
}
assert.equal(commonMessages.vi.nav.reading, "Đọc");
assert.equal(commonMessages.en.nav.reading, "Reading");

function source(name: string) {
  return readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8");
}

function tokens(text: string, expected: string[], label: string) {
  for (const token of expected) {
    assert.ok(text.includes(token), `${label}: missing ${token}`);
  }
}

const header = source("site-header");
const topRow = header.match(/<Container className="([^"]+)"/);
const rightGroup = header.match(/<div className="(ml-auto[^"]+)"/);
tokens(topRow?.[1] ?? "", ["min-w-0", "h-16", "gap-2", "sm:gap-4"], "header top row");
tokens(rightGroup?.[1] ?? "", ["min-w-0", "gap-1", "sm:gap-3"], "header right group");
tokens(header, ["<LanguageSwitch />", "<AuthSlot />"], "header controls");
const logo = header.match(/<Link\b[\s\S]*?>/);
tokens(logo?.[0] ?? "", ['href="/"', "aria-label={t.site.homeLabel(site.name)}", "shrink-0"], "logo");
tokens(header, [
  '<SiteNav className="hidden lg:flex" />',
  '<div className="border-t border-line/70 lg:hidden">',
  '<Container className="flex flex-wrap justify-center gap-1 py-2">',
  '<SiteNav className="flex flex-wrap justify-center" />',
], "header navigation");
tokens(source("site-nav"), ["<nav aria-label={t.primary}", "useVisiblePath()"], "primary navigation");

const auth = source("auth-slot");
const signedIn = auth.slice(auth.indexOf("const label ="));
const wrapper = signedIn.match(/<div className="([^"]+)"/);
const profile = signedIn.match(/<Link\b[\s\S]*?>/);
tokens(wrapper?.[1] ?? "", ["min-w-0"], "signed-in wrapper");
tokens(profile?.[0] ?? "", [
  'href="/profile"', "title={state.user.email}",
  "min-w-[3rem]", "max-w-[10rem]", "truncate",
], "profile chip");
const anonymous = auth.slice(auth.indexOf('if (state.status === "anonymous")'), auth.indexOf("const label ="));
tokens(anonymous, ["shrink-0", "whitespace-nowrap", "{t.logIn}", "{t.signUp}"], "anonymous controls");

tokens(source("logout-button"), [
  "shrink-0", "whitespace-nowrap", 'type="button"', "t.loggingOut", "t.logOut",
], "logout button");

console.log("PASS header layout and accessibility contracts (offline; browser verification separate)");
