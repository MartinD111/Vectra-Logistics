"use client";

import { usePathname } from "next/navigation";
import { Menu, FolderKanban, FileCode2 } from "lucide-react";
import { Navbar as SharedNavbar } from "@vectra/ui";
import { useCurrentWorkspace } from "@/lib/hooks/useTenantWorkspace";
import { useAuth } from "@/context/AuthContext";
import { usePlatform } from "@/context/PlatformContext";
import { useProjects, usePrograms } from "@/lib/hooks/useProjects";
import { useFolderTree } from "@/lib/hooks/useFolders";
import { FOLDER_ICON_MAP } from "@/components/icons/IconPicker";
import type { Project } from "@/lib/api/projects.api";
import type { FolderTree } from "@/lib/api/folders.api";

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: workspace } = useCurrentWorkspace();
  const { data: projects } = useProjects();
  const { data: programs } = usePrograms();
  const { data: folderTree } = useFolderTree();
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

  const projectNavItem = (project: Project) => ({
    name: project.name,
    href: `/projects/${project.id}`,
    icon: FolderKanban,
    subItems: (programs ?? [])
      .filter((p) => p.project_id === project.id)
      .map((prog) => ({ name: prog.name, href: `/programs/${prog.id}`, icon: FileCode2 })),
  });

  // Root folders render as top-level nav items. Their dropdown lists direct
  // child folders (as leaf links — deeper nesting is managed from the
  // folder-aware Projects/Programs views, not the navbar) and the projects
  // filed directly in the folder (with their programs one level deeper).
  // Unfiled projects keep rendering exactly as before, with no folders in play.
  const folderNavItem = (folder: FolderTree) => ({
    name: folder.name,
    href: "/projects",
    icon: FOLDER_ICON_MAP[folder.icon ?? ""] ?? FolderKanban,
    subItems: [
      ...folder.children.map((child) => ({
        name: child.name,
        href: "/projects",
        icon: FOLDER_ICON_MAP[child.icon ?? ""] ?? FolderKanban,
      })),
      ...(projects ?? [])
        .filter((p) => p.folder_id === folder.id)
        .map((project) => projectNavItem(project)),
    ],
  });

  const navigation = [
    ...(folderTree ?? []).map((folder) => folderNavItem(folder)),
    ...(projects ?? []).filter((p) => !p.folder_id).map((project) => projectNavItem(project)),
  ];

  return <SharedNavbar branding={branding} leftSlot={leftSlot} navigation={navigation} />;
}
