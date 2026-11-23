import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertCircle,
  Calendar,
  Bell,
  MessageSquare,
  Building2,
  CalendarCheck2,
  BarChart2,
  ListTodo,
  Briefcase,
  ShieldCheck,
  Milestone,
  FileSpreadsheet,
  PackageCheck,
  BookOpen,
  Code2,
  Users,
  KeyRound,
  Boxes,
  HeartPulse,
  UserCog,
  Sliders,
  Menu,
  Search,
  Plus,
  Upload,
  Download,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  User,
  LogOut,
  Palette,
} from "lucide-react";
import { ICONS } from "./icon-paths";

const LUCIDE_ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  approvals: ClipboardCheck,
  issues: AlertCircle,
  calendar: Calendar,
  reminders: Bell,
  chat: MessageSquare,
  admin: Building2,
  daily: CalendarCheck2,
  overview: BarChart2,
  tasks: ListTodo,
  workload: Briefcase,
  uat: ShieldCheck,
  plan: Milestone,
  reports: FileSpreadsheet,
  delivered: PackageCheck,
  manuals: BookOpen,
  developers: Code2,
  users: Users,
  licences: KeyRound,
  modules: Boxes,
  health: HeartPulse,
  accounts: UserCog,
  panel: Sliders,
  menu: Menu,
  search: Search,
  plus: Plus,
  upload: Upload,
  download: Download,
  alert: AlertTriangle,
  close: X,
  chevR: ChevronRight,
  chevL: ChevronLeft,
  chevD: ChevronDown,
  bell: Bell,
  account: User,
  logout: LogOut,
  palette: Palette,
};

const EXTRA: Record<string, string> = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M5 21h14"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/>',
  accounts: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  palette: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 3a9 9 0 0 1 0 18"/>',
};

export const hasIcon = (name: string) => name in LUCIDE_ICONS || name in ICONS || name in EXTRA;

/** Lucide-backed icon with fallback to SVG paths. */
export function Icon({ name, className = "i" }: { name: string; className?: string }) {
  const LucideComp = LUCIDE_ICONS[name];
  if (LucideComp) {
    return <LucideComp className={className} aria-hidden="true" />;
  }
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? EXTRA[name] ?? "" }} />;
}
