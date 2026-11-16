import { profileMessages } from "@/i18n/messages/profile";
import { getMessages } from "@/i18n/server";
import Link from "next/link";

import { commonMessages } from "@/i18n/messages/common";
import { navigation } from "@/lib/site";
import { sheet } from "@/lib/ui";

/** Shortcuts from the profile page into the (session-protected) modules. */
export async function SiteNavLinks() {
  const t = await getMessages(profileMessages);
  const nav = (await getMessages(commonMessages)).nav;
  return (
    <nav aria-labelledby="continue-heading" className="mt-8">
      <h2 id="continue-heading" className="text-2xl font-semibold text-ink">
        {t.continue}
      </h2>
      <ul className={`${sheet} mt-3 divide-y divide-line`}>
        {navigation.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block px-5 py-3.5 font-medium text-ink transition-colors hover:bg-canvas"
            >
              {nav[item.key]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
