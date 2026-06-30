"use client";

import {
  LayoutDashboard,
  BarChart3,
  Navigation2,
  Zap,
  Briefcase,
  Truck,
} from "lucide-react";
import { Navbar as SharedNavbar, AppSwitcher, type NavItem } from "@vectra/ui";
import { useAuth } from "@/context/AuthContext";
import { NotificationBell } from "@vectra/data";
import { useCurrentWorkspace } from "@/lib/hooks/useTenantWorkspace";

// Workspaces-app navigation. Each app owns its own nav array — the shared
// Navbar shell renders whatever it is given. CMR moved to its own app (reach it
// via the app-switcher). "Marketplace Intelligence" is the tenant's own
// analytics page and stays here; the public marketplace board lives in the
// Marketplace app (moved in Phase 2e).
const navigation: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace Intelligence", href: "/marketplace", icon: BarChart3 },
  { name: "Vectra Routes", href: "/routes", icon: Navigation2 },
  { name: "Automations", href: "/automations", icon: Zap },
  { name: "Workspace", href: "/workspaces", icon: Briefcase },
  { name: "My Fleet", href: "/fleet", icon: Truck },
];

export default function Navbar() {
  const { user } = useAuth();
  const { data: workspace } = useCurrentWorkspace();

  // Tenant-branded header: when the company's workspace has a custom logo or
  // title, show those; otherwise fall back to the default Vectra branding. A
  // tenant-uploaded logo is a normal-color image, so the white-logo invert
  // filter is only applied to the default asset.
  const tenantLogo = workspace?.logo_url ?? null;
  const tenantTitle = workspace?.header_title || workspace?.name || null;
  const branding = tenantLogo
    ? { logoSrc: tenantLogo, title: tenantTitle ?? "Workspace", homeHref: "/" }
    : {
        logoSrc: tenantTitle ? null : "/logo.png",
        title: tenantTitle ?? "VECTRA",
        logoStyle: { filter: "invert(1)", mixBlendMode: "screen" as const },
        homeHref: "/",
      };

  return (
    <SharedNavbar
      navigation={navigation}
      branding={branding}
      rightSlot={
        <>
          {user && <NotificationBell />}
          <AppSwitcher current="workspaces" />
        </>
      }
    />
  );
}
