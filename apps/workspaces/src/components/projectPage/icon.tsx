'use client';

// Resolve a lucide icon by name for project-page blocks (registry stores names
// as strings so page configs stay plain JSON). Unknown names fall back to a
// neutral square.
import {
  Heading, Type, Minus, Users, User, Gauge, Target, BarChart3, History, FileCode2,
  Calendar, Mail, LayoutDashboard, BookText, FileText, Square,
  Heading1, Heading2, Heading3, List, ListOrdered, Play, Kanban,
  Truck, Calculator, Radar, MessagesSquare, ScanText, ClipboardCheck,
  Warehouse, TrainTrack, PackageCheck, Building2, Percent, Receipt, Sparkles,
  CheckSquare, Quote, Code2, Table2, Image, File, Bookmark, Frame, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  Heading, Type, Minus, Users, User, Gauge, Target, BarChart3, History, FileCode2,
  Calendar, Mail, LayoutDashboard, NotebookText: BookText, FileText,
  Heading1, Heading2, Heading3, List, ListOrdered, Play, Kanban,
  Truck, Calculator, Radar, MessagesSquare, ScanText, ClipboardCheck,
  Warehouse, TrainTrack, PackageCheck, Building2, Percent, Receipt, Sparkles,
  CheckSquare, Quote, Code2, Table2, Image, File, Bookmark, Frame,
};

export function PageBlockIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && MAP[name]) || Square;
  return <Cmp className={className} />;
}
