'use client';

// Curated set of lucide icons suitable for folders — a picker over a subset,
// not all of lucide, to keep the grid usable. Same name-string resolution
// pattern as miniProgram/icon.tsx's BlockIcon, so folder icons stay plain
// strings in JSON/DB rather than component references.
import {
  Folder, FolderOpen, Briefcase, Truck, Package, Users, BarChart3, Calendar,
  Building2, Rocket, Star, Flag, Archive, Layers, Boxes, ClipboardList,
  Target, Wallet, ShieldCheck, Globe, Wrench, Zap, Home, Map,
  type LucideIcon,
} from 'lucide-react';

export const FOLDER_ICON_MAP: Record<string, LucideIcon> = {
  Folder, FolderOpen, Briefcase, Truck, Package, Users, BarChart3, Calendar,
  Building2, Rocket, Star, Flag, Archive, Layers, Boxes, ClipboardList,
  Target, Wallet, ShieldCheck, Globe, Wrench, Zap, Home, Map,
};

export function FolderIcon({
  name,
  className,
  style,
}: {
  name?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Cmp = (name && FOLDER_ICON_MAP[name]) || Folder;
  return <Cmp className={className} style={style} />;
}

export function IconPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5 p-2 max-h-48 overflow-y-auto">
      {Object.entries(FOLDER_ICON_MAP).map(([name, Icon]) => {
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            aria-label={name}
            title={name}
            className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-colors ${
              selected
                ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
