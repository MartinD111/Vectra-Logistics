// @vectra/ui — shared UI components for all three Vectra apps.
//
// The Navbar is a shell: each app supplies its own `navigation` and `branding`
// (and, for the Workspaces app, tenant branding) via props. AppProviders sets
// up theme + react-query for every app. The app-switcher and cross-app link
// helper are added in Phase 2b.

export { Navbar } from './Navbar';
export type { NavbarProps, NavbarBranding, NavItem } from './Navbar';
export { AppProviders } from './AppProviders';
export { AppSwitcher } from './AppSwitcher';
export { appUrls, crossAppUrl } from './appUrls';
export type { VectraApp } from './appUrls';
