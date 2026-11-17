/**
 * Offline check: the account forms post. They are handled by JavaScript, but
 * without it a form with no method is sent with GET and the password ends up
 * in the URL, the browser history and server logs (found by an OWASP ZAP scan).
 *   npx tsx scripts/checks/check-auth-forms.ts
 */
import { readFileSync } from "node:fs";

let failures = 0;
for (const name of ["login-form", "register-form", "change-password-form", "edit-name-form"]) {
  const source = readFileSync(new URL(`../../src/components/${name}.tsx`, import.meta.url), "utf8");
  const forms = source.match(/<form\b[^>]*>/g) ?? [];
  const ok = forms.length > 0 && forms.every((tag) => /\bmethod="post"/.test(tag));
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${forms.length} form(s) with method="post"`);
}
console.log(failures === 0 ? "PASS account forms never send passwords in the URL" : `FAIL ${failures}`);
if (failures > 0) process.exitCode = 1;
