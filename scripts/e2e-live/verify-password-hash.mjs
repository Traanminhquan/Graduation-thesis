// Read-only check: are stored passwords bcrypt hashes, and does the plaintext
// appear anywhere in the column? Prints a prefix + length only, never a hash.
//
//   node --env-file=.env scripts/e2e-live/verify-password-hash.mjs
import { PrismaClient } from "@prisma/client";

const KNOWN_TEST_PLAINTEXT = "Test-Passw0rd-2026";

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  orderBy: { createdAt: "asc" },
  select: { id: true, email: true, name: true, passwordHash: true, createdAt: true },
});

for (const user of users) {
  const isBcrypt = /^\$2[aby]\$(\d{2})\$/.test(user.passwordHash);
  const cost = isBcrypt ? user.passwordHash.slice(4, 6) : "n/a";
  const prefix = user.passwordHash.slice(0, 7);
  const containsPlaintext = user.passwordHash.includes(KNOWN_TEST_PLAINTEXT);
  console.log(
    [
      user.email,
      `name=${user.name ?? "null"}`,
      `bcrypt=${isBcrypt}`,
      `prefix=${prefix}`,
      `cost=${cost}`,
      `hashLength=${user.passwordHash.length}`,
      `containsPlaintext=${containsPlaintext}`,
      `id=${user.id}`,
    ].join(" | "),
  );
}

console.log(`total users: ${users.length}`);
await prisma.$disconnect();
