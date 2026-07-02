"use client";

import { usePathname } from "next/navigation";
import { Menu, FolderKanban, FileCode2 } from "lucide-react";
import { Navbar as SharedNavbar } from "@vectra/ui";
import { useCurrentWorkspace } from "@/lib/hooks/useTenantWorkspace";
import { useAuth } from "@/context/AuthContext";
import { usePlatform } from "@/context/PlatformContext";
import { useProjects, usePrograms } from "@/lib/hooks/useProjects";

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: workspace } = useCurrentWorkspace();
  const { data: projects } = useProjects();
  const { data: programs } = usePrograms();
  const { sidebarOpen, setSidebarOpen } = usePlatform();

  const NO_SIDEBAR = ["/", "/auth", "/setup", "/how-it-works"];
  const hideSidebar =
    NO_SIDEBAR.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p))) || !user;

  // Tenant-branded header: when the company's workspace has a custom logo or
  // title, show those; otherwise fall back to the default Vectra branding.
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

  const leftSlot = !hideSidebar ? (
    <button
      onClick={() => setSidebarOpen((prev) => !prev)}
      className="hidden lg:block p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none"
      title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
    >
      <Menu className="w-5 h-5" />
    </button>
  ) : null;

  const navigation = (projects ?? []).map((project) => {
    const projectPrograms = (programs ?? []).filter((p) => p.project_id === project.id);
    return {
      name: project.name,
      href: `/projects/${project.id}`,
      icon: FolderKanban,
      subItems: projectPrograms.map((prog) => ({
        name: prog.name,
        href: `/programs/${prog.id}`,
        icon: FileCode2,
      })),
    };
  });

  return <SharedNavbar branding={branding} leftSlot={leftSlot} navigation={navigation} />;
}
