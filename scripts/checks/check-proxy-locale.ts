import { readFileSync } from "node:fs";
import ts from "typescript";

import { unprefixedPath } from "../../src/lib/locale-path";

function check(label: string, passed: boolean) {
  console.log(`${passed ? "ok" : "FAIL"} ${label}`);
  if (!passed) process.exitCode = 1;
}

const cases: [string, string | null][] = [
  ["/vi", "/"],
  ["/en", "/"],
  ["/vi/", "/"],
  ["/en/", "/"],
  ["/vi/reading/a", "/reading/a"],
  ["/en/login", "/login"],
  ["/", null],
  ["/reading", null],
  ["/video", null],
  ["/enrol", null],
  ["/api/auth/login", null],
  ["/vietnam/x", null],
];

for (const [pathname, expected] of cases) {
  check(`${pathname} -> ${expected ?? "no redirect"}`, unprefixedPath(pathname) === expected);
}

const source = ts.createSourceFile(
  "proxy.ts",
  readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const matcherSources: string[] = [];
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(source) !== "config" || !declaration.initializer ||
        !ts.isObjectLiteralExpression(declaration.initializer)) continue;
    for (const property of declaration.initializer.properties) {
      if (!ts.isPropertyAssignment(property) || property.name.getText(source) !== "matcher" ||
          !ts.isArrayLiteralExpression(property.initializer)) continue;
      for (const element of property.initializer.elements) {
        if (ts.isStringLiteral(element)) matcherSources.push(element.text);
      }
    }
  }
}
for (const prefix of ["vi", "en"]) {
  check(`matcher includes /${prefix}/:path*`, matcherSources.includes(`/${prefix}/:path*`));
}
