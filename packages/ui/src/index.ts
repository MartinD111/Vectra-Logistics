// @vectra/ui — shared UI components for all three Vectra apps.
//
// The Navbar is a shell: each app supplies its own `navigation` and `branding`
// (and, for the Workspaces app, tenant branding) via props. The app-switcher
// lands in Phase 2.

export { Navbar } from './Navbar';
export type { NavbarProps, NavbarBranding, NavItem } from './Navbar';
