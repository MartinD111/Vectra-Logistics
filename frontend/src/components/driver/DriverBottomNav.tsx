'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, ClockIcon, Settings2 } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/active',  label: 'Active Load', Icon: Truck },
  { href: '/history', label: 'History',     Icon: ClockIcon },
  { href: '/settings', label: 'Settings',   Icon: Settings2 },
] as const;

export function DriverBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed bottom-0 inset-x-0 z-50
        bg-slate-900 border-t border-slate-700
        flex
        pb-[env(safe-area-inset-bottom)]
      "
      aria-label="Driver navigation"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1
              min-h-[4.5rem] select-none
              transition-colors duration-150 active:bg-slate-800
              ${active ? 'text-primary-400' : 'text-slate-400'}
            `}
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              size={26}
              strokeWidth={active ? 2.5 : 1.8}
              aria-hidden="true"
            />
            <span className="text-xs font-medium tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
