"use client";

import {
  LayoutDashboard,
  BarChart3,
  Navigation2,
  Zap,
  FileText,
  Briefcase,
  Truck,
} from "lucide-react";
import { Navbar as SharedNavbar, type NavItem } from "@vectra/ui";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";

// Workspaces-app navigation. Each app owns its own nav array — the shared
// Navbar shell renders whatever it is given. In Phase 2 the marketplace/CMR
// items move to their own apps and this list narrows to the Workspaces surface.
const navigation: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace Intelligence", href: "/marketplace", icon: BarChart3 },
  { name: "Vectra Routes", href: "/routes", icon: Navigation2 },
  { name: "Automations", href: "/automations", icon: Zap },
  { name: "CMR Helper", href: "/cmr-helper", icon: FileText },
  { name: "Workspace", href: "/workspaces", icon: Briefcase },
  { name: "My Fleet", href: "/fleet", icon: Truck },
];

export default function Navbar() {
  const { user } = useAuth();

  return (
    <SharedNavbar
      navigation={navigation}
      branding={{
        // White logo asset inverted for light/dark; tenant branding wires in
        // here in Phase 3 (logo/title/colors from the active workspace).
        logoSrc: "/logo.png",
        title: "VECTRA",
        logoStyle: { filter: "invert(1)", mixBlendMode: "screen" },
        homeHref: "/",
      }}
      rightSlot={user ? <NotificationBell /> : null}
    />
  );
}
