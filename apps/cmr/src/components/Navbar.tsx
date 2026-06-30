"use client";

import { FileText, LayoutDashboard } from "lucide-react";
import { Navbar as SharedNavbar, AppSwitcher, type NavItem } from "@vectra/ui";

// CMR Manager surface navigation. Standalone product; the app-switcher in the
// right slot lets users jump to Marketplace / Workspaces.
const navigation: NavItem[] = [
  { name: "CMR Documents", href: "/", icon: FileText },
  { name: "Templates", href: "/templates", icon: LayoutDashboard },
];

export default function Navbar() {
  return (
    <SharedNavbar
      navigation={navigation}
      branding={{
        logoSrc: "/logo.png",
        title: "VECTRA CMR",
        logoStyle: { filter: "invert(1)", mixBlendMode: "screen" },
        homeHref: "/",
      }}
      rightSlot={<AppSwitcher current="cmr" />}
    />
  );
}
