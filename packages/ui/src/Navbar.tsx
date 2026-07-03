'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Menu, X, User, LogOut, Settings, CreditCard } from 'lucide-react';
import { useAuth } from '@vectra/auth';

export interface NavSubItem {
  name: string;
  href: string;
  icon?: LucideIcon;
  /** One further nesting level (e.g. a subfolder's own items). */
  subItems?: NavSubItem[];
}

export interface NavItem {
  name: string;
  href: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
}

export interface NavbarBranding {
  /** Logo image source. If omitted, `title` text is shown instead. */
  logoSrc?: string | null;
  /** Brand/title text (used as the logo alt, and as fallback when no logo). */
  title: string;
  /** Optional CSS filter for the logo (the workspaces app inverts a white logo). */
  logoStyle?: React.CSSProperties;
  /** Where the brand/logo links to. Defaults to "/". */
  homeHref?: string;
}

export interface NavbarProps {
  /**
   * Per-app navigation items — supplied by each app, never hardcoded here.
   * Optional: omit (or pass []) for a minimal header (logo + sign-in only).
   */
  navigation?: NavItem[];
  /** Per-app/per-tenant branding for the header. */
  branding: NavbarBranding;
  /** Optional slot rendered left of the brand logo (e.g. sidebar toggle). */
  leftSlot?: ReactNode;
  /** Optional slot rendered left of the profile menu (e.g. notifications). */
  rightSlot?: ReactNode;
  /** Where "Sign In" and post-logout routing point. Defaults to "/auth". */
  authHref?: string;
}

/**
 * Shared header shell for all three Vectra apps. Navigation and branding are
 * supplied per-app via props — this component contains no app- or tenant-
 * specific content of its own. With no `navigation`, it renders a minimal
 * header: logo (links home) + Sign In / profile menu.
 */
export function Navbar({ navigation = [], branding, leftSlot, rightSlot, authHref = '/auth' }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const homeHref = branding.homeHref ?? '/';

  const handleLogout = () => {
    logout();
    setProfileDropdownOpen(false);
    router.push('/');
  };

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}` : '';

  const isActive = (href: string) =>
    pathname === href || (href !== homeHref && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border transition-colors">
      <nav
        className="w-full flex items-center justify-between px-4 lg:px-8 h-16"
        aria-label="Global"
      >
        {/* Logo / brand — far left */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {leftSlot}
          <Link href={homeHref} className="flex items-center">
            {branding.logoSrc ? (
              <Image
                src={branding.logoSrc}
                alt={branding.title}
                width={120}
                height={32}
                className="h-8 w-auto object-contain"
                style={branding.logoStyle}
                priority
              />
            ) : (
              <span className="text-xl font-black tracking-tight text-primary-600 dark:text-primary-400">
                {branding.title}
              </span>
            )}
          </Link>
        </div>

        {/* Desktop Nav — center */}
        <div className="hidden lg:flex gap-x-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            if (item.subItems && item.subItems.length > 0) {
              return (
                <div key={item.name} className="relative group flex items-center">
                  <Link
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      active
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {item.name}
                  </Link>
                  {/* Dropdown Menu */}
                  <div className="absolute left-0 top-full pt-1.5 hidden group-hover:block z-50 w-56 animate-fade-in">
                    <div className="rounded-xl bg-white dark:bg-dark-card shadow-lg border border-gray-100 dark:border-dark-border py-1">
                      {item.subItems.map((sub) => {
                        const SubIcon = sub.icon;
                        const hasNested = sub.subItems && sub.subItems.length > 0;
                        return (
                          <div key={sub.name} className={hasNested ? 'relative group/sub' : undefined}>
                            <Link
                              href={sub.href}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                            >
                              {SubIcon && <SubIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                              <span className="truncate">{sub.name}</span>
                            </Link>
                            {hasNested && (
                              <div className="absolute left-full top-0 pl-1.5 hidden group-hover/sub:block z-50 w-56 animate-fade-in">
                                <div className="rounded-xl bg-white dark:bg-dark-card shadow-lg border border-gray-100 dark:border-dark-border py-1">
                                  {sub.subItems!.map((leaf) => {
                                    const LeafIcon = leaf.icon;
                                    return (
                                      <Link
                                        key={leaf.name}
                                        href={leaf.href}
                                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                                      >
                                        {LeafIcon && <LeafIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                                        <span className="truncate">{leaf.name}</span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Desktop Right — slot + profile / sign-in */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          {rightSlot}
          {user ? (
            <div className="relative">
              <button
                id="profile-menu-button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-x-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100 p-1.5 pr-3 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-black shadow">
                  {initials}
                </div>
                <span className="hidden xl:block">{user.first_name}</span>
                <div
                  className={`w-2 h-2 rounded-full ${user.is_verified ? 'bg-green-500' : 'bg-yellow-500'}`}
                  title={user.is_verified ? 'Verified' : 'Pending verification'}
                />
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl bg-white dark:bg-dark-card shadow-lg border border-gray-100 dark:border-dark-border py-1 animate-fade-in">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                      <span
                        className={`mt-1.5 inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                          user.role === 'carrier'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : user.role === 'shipper'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>

                    <Link
                      id="nav-profile"
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      <User className="h-4 w-4" /> My Profile
                    </Link>
                    <Link
                      id="nav-billing"
                      href="/billing"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      <CreditCard className="h-4 w-4" /> Billing
                    </Link>
                    <Link
                      id="nav-settings"
                      href="/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <div className="border-t border-gray-100 dark:border-dark-border mt-1 pt-1">
                      <button
                        id="nav-logout"
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              id="nav-signin"
              href={authHref}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 transition px-5 py-2.5 rounded-xl shadow-sm"
            >
              <User className="h-4 w-4" /> Sign In
            </Link>
          )}
        </div>

        {/* Mobile area: hamburger when there's nav; otherwise sign-in / profile */}
        <div className="flex lg:hidden items-center gap-2">
          {navigation.length > 0 ? (
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-200"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          ) : user ? (
            <Link
              href="/profile"
              className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-black shadow"
            >
              {initials}
            </Link>
          ) : (
            <Link
              href={authHref}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 transition px-4 py-2 rounded-xl shadow-sm"
            >
              <User className="h-4 w-4" /> Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile slide-in panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden animate-fade-in">
          <div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white dark:bg-dark-bg px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Link
                href={homeHref}
                className="-m-1.5 p-1.5"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="text-xl font-black tracking-tight text-primary-600 dark:text-primary-400">
                  {branding.title}
                </span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700 dark:text-gray-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10 dark:divide-dark-border">
                <div className="space-y-1 py-6">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <div key={item.name} className="space-y-1">
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold leading-7 transition-colors ${
                            active
                              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                              : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
                          {item.name}
                        </Link>
                        {item.subItems && item.subItems.length > 0 && (
                          <div className="pl-6 space-y-1 border-l border-gray-100 dark:border-slate-800 ml-5">
                            {item.subItems.map((sub) => {
                              const SubIcon = sub.icon;
                              return (
                                <div key={sub.name}>
                                  <Link
                                    href={sub.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    {SubIcon && <SubIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />}
                                    {sub.name}
                                  </Link>
                                  {sub.subItems && sub.subItems.length > 0 && (
                                    <div className="pl-6 space-y-1 border-l border-gray-100 dark:border-slate-800 ml-3">
                                      {sub.subItems.map((leaf) => {
                                        const LeafIcon = leaf.icon;
                                        return (
                                          <Link
                                            key={leaf.name}
                                            href={leaf.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                          >
                                            {LeafIcon && <LeafIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />}
                                            {leaf.name}
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="py-6 space-y-2">
                  {user ? (
                    <>
                      <div className="flex items-center gap-3 px-3 py-2 mb-2">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {user.role}
                          </p>
                        </div>
                      </div>

                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                      >
                        <User className="h-5 w-5 flex-shrink-0" /> My Profile
                      </Link>
                      <Link
                        href="/billing"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                      >
                        <CreditCard className="h-5 w-5 flex-shrink-0" /> Billing
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                      >
                        <Settings className="h-5 w-5 flex-shrink-0" /> Settings
                      </Link>
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left"
                      >
                        <LogOut className="h-5 w-5 flex-shrink-0" /> Log out
                      </button>
                    </>
                  ) : (
                    <Link
                      href={authHref}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-white bg-primary-600 hover:bg-primary-500 transition"
                    >
                      <User className="h-5 w-5 flex-shrink-0" /> Sign In / Sign Up
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
