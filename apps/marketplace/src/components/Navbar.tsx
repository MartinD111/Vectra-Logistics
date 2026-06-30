"use client";

import { Navbar as SharedNavbar } from "@vectra/ui";

// Minimal header: logo (links to the board) + Sign In only.
export default function Navbar() {
  return (
    <SharedNavbar
      branding={{
        logoSrc: "/logo.png",
        title: "VECTRA",
        logoStyle: { filter: "invert(1)", mixBlendMode: "screen" },
        homeHref: "/board",
      }}
    />
  );
}
