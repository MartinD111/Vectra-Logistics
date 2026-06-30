"use client";

import { LayoutGrid, PackagePlus, TruckIcon } from "lucide-react";
import { Navbar as SharedNavbar, AppSwitcher, type NavItem } from "@vectra/ui";
import { useAuth } from "@vectra/auth";
import { NotificationBell } from "@vectra/data";

// Marketplace surface navigation — the public trading floor. The app-switcher
// jumps to Workspaces / CMR.
const navigation: NavItem[] = [
  { name: "Board", href: "/board", icon: LayoutGrid },
  { name: "Post Shipment", href: "/post-shipment", icon: PackagePlus },
  { name: "Add Capacity", href: "/add-capacity", icon: TruckIcon },
];

export default function Navbar() {
  const { user } = useAuth();

  return (
    <SharedNavbar
      navigation={navigation}
      branding={{
        logoSrc: "/logo.png",
        title: "VECTRA",
        logoStyle: { filter: "invert(1)", mixBlendMode: "screen" },
        homeHref: "/board",
      }}
      rightSlot={
        <>
          {user && <NotificationBell />}
          <AppSwitcher current="marketplace" />
        </>
      }
    />
  );
}
