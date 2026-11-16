#!/usr/bin/env bash
# End-to-end auth smoke test against a running production build.
#
#   npm run build && npx next start -p 3100 &
#   BASE=http://localhost:3100 bash scripts/auth-e2e.sh
#
# Registers one throwaway user (a real INSERT into the live `users` table),
# then exercises logout / login / profile / redirect behaviour. Prints only
# status codes, headers and non-secret fields.

set -u

BASE="${BASE:-http://localhost:3100}"
# Native Windows curl cannot write to an MSYS /tmp path, so keep the jar beside
# the script by default. Override with JAR=/path/to/jar if you prefer.
JAR="${JAR:-$(dirname "$0")/.auth-e2e-cookies.txt}"
EMAIL="demo.$(date +%s)@example.com"
PASSWORD="Test-Passw0rd-2026"
FAILURES=0

rm -f "$JAR"

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILURES=$((FAILURES + 1)); }

status_of() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
location_of() { curl -s -o /dev/null -D - "$@" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}'; }

echo "== 1. Anonymous request to a protected page =="
CODE=$(status_of "$BASE/profile")
LOC=$(location_of "$BASE/profile")
echo "   GET /profile -> $CODE, location: $LOC"
[ "$CODE" = "307" ] && [ "$LOC" = "/login" ] && pass "anonymous /profile redirects to /login" \
  || fail "anonymous /profile did not redirect as expected"

CODE=$(status_of "$BASE/reading")
echo "   GET /reading -> $CODE"
[ "$CODE" = "307" ] && pass "anonymous /reading redirects" || fail "anonymous /reading was not blocked"

CODE=$(status_of "$BASE/login")
echo "   GET /login -> $CODE"
[ "$CODE" = "200" ] && pass "login page reachable while anonymous" || fail "login page not reachable"

echo
echo "== 2. Registration =="
echo "   test email: $EMAIL"
REG=$(curl -s -c "$JAR" -w '\n%{http_code}' -H 'content-type: application/json' \
  -d "{\"name\":\"Demo Learner\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "$BASE/api/auth/register")
REG_CODE=$(printf '%s' "$REG" | tail -n1)
REG_BODY=$(printf '%s' "$REG" | sed '$d')
echo "   POST /api/auth/register -> $REG_CODE"
echo "   body: $REG_BODY"
[ "$REG_CODE" = "201" ] && pass "registration created the account" || fail "registration failed"

echo "   Set-Cookie flags:"
curl -s -o /dev/null -D - -H 'content-type: application/json' \
  -d "{\"name\":\"Header Probe\",\"email\":\"probe.$(date +%s)@example.com\",\"password\":\"$PASSWORD\"}" \
  "$BASE/api/auth/register" | tr -d '\r' | grep -i '^set-cookie:' | sed -E 's/(el_session=)[^;]+/\1<redacted>/'

echo
echo "== 3. Session endpoint =="
SESSION=$(curl -s -b "$JAR" -w '\n%{http_code}' "$BASE/api/auth/session")
SESS_CODE=$(printf '%s' "$SESSION" | tail -n1)
SESS_BODY=$(printf '%s' "$SESSION" | sed '$d')
echo "   GET /api/auth/session -> $SESS_CODE"
echo "   body: $SESS_BODY"
[ "$SESS_CODE" = "200" ] && pass "session endpoint answers while signed in" || fail "session endpoint failed"
printf '%s' "$SESS_BODY" | grep -q 'passwordHash' && fail "passwordHash leaked in session payload" \
  || pass "no passwordHash in session payload"

echo
echo "== 4. Profile page renders the right user =="
PROFILE_HTML=$(curl -s -b "$JAR" "$BASE/profile")
printf '%s' "$PROFILE_HTML" | grep -q 'Demo Learner' && pass "profile shows the user name" || fail "name missing on profile"
printf '%s' "$PROFILE_HTML" | grep -q "$EMAIL" && pass "profile shows the user email" || fail "email missing on profile"
printf '%s' "$PROFILE_HTML" | grep -qi 'passwordHash\|\$2[aby]\$' && fail "hash-like string in profile HTML" \
  || pass "no hash-like string in profile HTML"

echo
echo "== 5. Protected page while signed in =="
CODE=$(status_of -b "$JAR" "$BASE/reading")
echo "   GET /reading -> $CODE"
[ "$CODE" = "200" ] && pass "signed-in user reaches /reading" || fail "signed-in user blocked from /reading"

echo
echo "== 6. Logout =="
CODE=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/logout")
echo "   POST /api/auth/logout -> $CODE"
[ "$CODE" = "200" ] && pass "logout accepted" || fail "logout failed"
CODE=$(status_of -b "$JAR" "$BASE/profile")
echo "   GET /profile after logout -> $CODE"
[ "$CODE" = "307" ] && pass "session gone after logout" || fail "session survived logout"
SESS_BODY=$(curl -s -b "$JAR" "$BASE/api/auth/session")
[ "$SESS_BODY" = '{"user":null}' ] && pass "session endpoint returns null user" || echo "   (session body: $SESS_BODY)"

echo
echo "== 7. Login with the wrong password =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"definitely-wrong\"}" "$BASE/api/auth/login")
echo "   POST /api/auth/login (wrong password) -> $CODE"
[ "$CODE" = "401" ] && pass "wrong password rejected" || fail "wrong password was not rejected"

echo
echo "== 8. Login with the right password =="
LOGIN=$(curl -s -c "$JAR" -w '\n%{http_code}' -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/login")
LOGIN_CODE=$(printf '%s' "$LOGIN" | tail -n1)
echo "   POST /api/auth/login -> $LOGIN_CODE"
[ "$LOGIN_CODE" = "200" ] && pass "login succeeded" || fail "login failed"
CODE=$(status_of -b "$JAR" "$BASE/profile")
echo "   GET /profile after login -> $CODE"
[ "$CODE" = "200" ] && pass "profile reachable after login" || fail "profile blocked after login"

echo
echo "== 9. Duplicate registration / validation =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -d "{\"name\":\"Demo Learner\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/register")
echo "   POST /api/auth/register (existing email) -> $CODE"
[ "$CODE" = "409" ] && pass "duplicate email rejected" || fail "duplicate email accepted"

BAD=$(curl -s -w '\n%{http_code}' -H 'content-type: application/json' \
  -d '{"name":"","email":"not-an-email","password":"short"}' "$BASE/api/auth/register")
BAD_CODE=$(printf '%s' "$BAD" | tail -n1)
echo "   POST /api/auth/register (invalid fields) -> $BAD_CODE"
echo "   body: $(printf '%s' "$BAD" | sed '$d')"
[ "$BAD_CODE" = "400" ] && pass "invalid input rejected with 400" || fail "invalid input not rejected"

echo
echo "== 10. Authenticated visit to /login is bounced to /profile =="
CODE=$(status_of -b "$JAR" "$BASE/login")
LOC=$(location_of -b "$JAR" "$BASE/login")
echo "   GET /login while signed in -> $CODE, location: $LOC"
[ "$CODE" = "307" ] && [ "$LOC" = "/profile" ] && pass "signed-in user redirected away from /login" \
  || fail "signed-in user saw /login"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "RESULT: all checks passed ($EMAIL)"
  exit 0
else
  echo "RESULT: $FAILURES check(s) failed"
  exit 1
fi
