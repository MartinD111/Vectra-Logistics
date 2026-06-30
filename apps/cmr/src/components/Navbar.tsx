"use client";

import { Navbar as SharedNavbar } from "@vectra/ui";

// Minimal header: logo (links home) + Sign In only. CMR Manager works for
// signed-out users; signing in just adds history of generated CMRs.
export default function Navbar() {
  return (
    <SharedNavbar
      branding={{
        logoSrc: "/logo.png",
        title: "VECTRA CMR",
        logoStyle: { filter: "invert(1)", mixBlendMode: "screen" },
        homeHref: "/",
      }}
    />
  );
}
