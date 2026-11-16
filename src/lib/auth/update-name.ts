import { type Locale } from "@/i18n/config";
import { isPlainObject, validateName, type FieldErrors } from "./validation";

export type NameDatabase = {
  user: {
    update(args: { where: { id: string }; data: { name: string } }): Promise<unknown>;
  };
};

export type UpdateNameResult = { ok: true; name: string } | { ok: false; errors: FieldErrors };

export async function updateName(
  userId: string,
  input: unknown,
  { db }: { db: NameDatabase },
  locale: Locale = "en",
): Promise<UpdateNameResult> {
  const body = isPlainObject(input) && [Object.prototype, null].includes(Object.getPrototypeOf(input)) ? input : {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const error = validateName(name, locale);
  if (error) return { ok: false, errors: { name: error } };
  await db.user.update({ where: { id: userId }, data: { name } });
  return { ok: true, name };
}
