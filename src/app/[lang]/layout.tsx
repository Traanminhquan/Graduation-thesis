import type { Metadata } from "next";
import { Be_Vietnam_Pro, Literata } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocaleProvider } from "@/i18n/client";
import { LOCALES } from "@/i18n/config";
import { commonMessages } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { site } from "@/lib/site";
import "../globals.css";

// Both families carry a Vietnamese subset, so accented letters (ạ, ế, ộ, ữ ...)
// never fall back to a system font in the middle of a word.
const serif = Literata({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext", "vietnamese"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const ui = Be_Vietnam_Pro({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

/** Both interface languages are prerendered; `next.config.ts` picks one per request. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = commonMessages[await getLocale()].site;
  return {
  title: {
    default: `${site.name} | ${t.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: t.description,
  applicationName: site.name,
  keywords: [
    "English learning",
    "reading",
    "listening",
    "writing",
    "speaking",
    "language practice",
  ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = commonMessages[locale];
  return (
    <html
      lang={locale}
      className={`${serif.variable} ${ui.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          {t.skipToContent}
        </a>
        <LocaleProvider locale={locale}>
          <SiteHeader />
          <main id="content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
