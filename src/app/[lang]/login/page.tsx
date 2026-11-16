import { authMessages } from "@/i18n/messages/auth";
import { getMessages } from "@/i18n/server";
import type { Metadata } from "next";

import { Container } from "@/components/container";
import { LoginForm } from "@/components/login-form";
import { sheet } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(authMessages);
  return { title: t.loginTitle };
}

export default async function LoginPage() {
  const t = await getMessages(authMessages);
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{t.welcome}</h1>

        <div className={`${sheet} mt-6 p-6 sm:p-8`}>
          <LoginForm />
        </div>
      </div>
    </Container>
  );
}
