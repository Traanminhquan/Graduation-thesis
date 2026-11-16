import { type Locale } from "@/i18n/config";
import { authMessages } from "@/i18n/messages/auth";
import { hashPassword, verifyPassword } from "./password";
import { isPlainObject, validatePassword, type FieldErrors } from "./validation";

export type PasswordDatabase = {
  user: {
    findUnique(args: { where: { id: string }; select: { passwordHash: true } }): Promise<{ passwordHash: string } | null>;
    update(args: { where: { id: string }; data: { passwordHash: string } }): Promise<unknown>;
  };
};

export type ChangePasswordResult =
  | { ok: false; reason: "fields"; errors: FieldErrors }
  | { ok: false; reason: "wrong-password" }
  | { ok: true; passwordHash: string };

export async function changePassword(
  userId: string,
  input: unknown,
  deps: { db: PasswordDatabase },
  locale: Locale = "en",
): Promise<ChangePasswordResult> {
  const body = isPlainObject(input) ? input : {};
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const errors: FieldErrors = {};
  if (!currentPassword) errors.currentPassword = authMessages[locale].currentRequired;
  const passwordError = validatePassword(newPassword, locale);
  if (passwordError) errors.newPassword = passwordError;
  else if (newPassword === currentPassword) errors.newPassword = authMessages[locale].differentPassword;
  if (Object.keys(errors).length) return { ok: false, reason: "fields", errors };

  const user = await deps.db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, reason: "wrong-password" };
  }
  const passwordHash = await hashPassword(newPassword);
  await deps.db.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true, passwordHash };
}
