"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Study" },
  { href: "/collection", label: "Collection" },
  { href: "/settings", label: "Settings" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="order-last grid shrink-0 grid-cols-3 border-t-heavy border-ink md:order-first md:border-t-0 md:border-b-heavy"
    >
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-r-hairline border-ink px-4 py-4 text-center text-label uppercase last:border-r-0 ${
              active ? "bg-accent text-background" : "bg-background text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
