"use client";

import { Navbar as SharedNavbar } from "@vectra/ui";
import { useCurrentWorkspace } from "@/lib/hooks/useTenantWorkspace";

// Minimal header: logo (links home) + Sign In only. In-app navigation lives in
// the Workspaces sidebar; cross-app navigation happens from the home launcher.
export default function Navbar() {
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

  return <SharedNavbar branding={branding} />;
}
