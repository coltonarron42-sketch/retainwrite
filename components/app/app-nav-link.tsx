"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { href: string; children: React.ReactNode; exact?: boolean };

/** /app header link. The current section gets ink text and a terracotta underline (PLAN.md 8.1 active state). */
export function AppNavLink({ href, children, exact = false }: Props) {
  const pathname = usePathname() || "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`ds-focus rounded-[8px] px-2 py-2 text-[16px] underline-offset-[6px] transition-colors duration-150 hover:text-ds-ink ${
        active
          ? "font-semibold text-ds-ink underline decoration-ds-accent decoration-2"
          : "text-ds-muted"
      }`}
    >
      {children}
    </Link>
  );
}
