import {
  ArrowLeftRight,
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  Briefcase,
  CheckCircle,
  ClipboardCheck,
  Component,
  FileCheck,
  FileCog,
  FileStack,
  FileText,
  FolderOpen,
  GalleryVertical,
  GitCompare,
  History,
  Home,
  Image,
  LayoutGrid,
  LayoutList,
  LayoutPanelLeft,
  LayoutTemplate,
  LifeBuoy,
  Library,
  Link,
  ListChecks,
  ListTodo,
  ListTree,
  Map,
  Palette,
  Play,
  Plug,
  Rocket,
  ScanSearch,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SwatchBook,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps `ModuleRegistrySummary.iconReference` (a real, already-seeded field — every one of the 43
 * modules has carried one of these 43 exact kebab-case values since migration `00035`, chosen
 * to match `lucide-react`'s own naming convention even though no icon library was ever installed
 * to consume them) onto the real icon component. Wiring this up is what the design canvas
 * "Enterprise Plus" direction's icon-per-nav-item/icon-per-module treatment needed — the data
 * was already there, `lucide-react` was the missing piece.
 */
/**
 * `keyof typeof ICON_MAP` (derived below, not hand-declared) gives internal-only compile-time
 * exhaustiveness for this file's own logic — `Object.keys`/lookups against `ICON_MAP` stay
 * type-checked against its real key set. It does NOT close the gap against the real wire type:
 * `ModuleRegistrySummary.iconReference` (`packages/shared-types`) is `string | null`, not a
 * literal union, because it's real backend data with no compiler-enforced tie to this frontend
 * map — a schema-level fix (turning the database column into a literal-backed type shared across
 * both apps) is its own separate, not-yet-requested scope. `moduleIcon()` below closes the other
 * half of that gap at runtime: an unrecognized value is logged, not silently absorbed.
 */
const ICON_MAP: Readonly<Record<string, LucideIcon>> = {
  home: Home,
  briefcase: Briefcase,
  "book-open": BookOpen,
  map: Map,
  "layout-list": LayoutList,
  "file-text": FileText,
  "file-check": FileCheck,
  library: Library,
  "gallery-vertical": GalleryVertical,
  palette: Palette,
  image: Image,
  "folder-open": FolderOpen,
  "swatch-book": SwatchBook,
  component: Component,
  "layout-grid": LayoutGrid,
  "layout-template": LayoutTemplate,
  "layout-panel-left": LayoutPanelLeft,
  play: Play,
  "check-circle": CheckCircle,
  "list-checks": ListChecks,
  users: Users,
  "shield-check": ShieldCheck,
  search: Search,
  link: Link,
  "file-stack": FileStack,
  bot: Bot,
  "file-cog": FileCog,
  "book-marked": BookMarked,
  "list-tree": ListTree,
  "list-todo": ListTodo,
  "clipboard-check": ClipboardCheck,
  "scan-search": ScanSearch,
  "git-compare": GitCompare,
  "arrow-left-right": ArrowLeftRight,
  wrench: Wrench,
  rocket: Rocket,
  history: History,
  "life-buoy": LifeBuoy,
  bell: Bell,
  "user-cog": UserCog,
  plug: Plug,
  settings: Settings,
  "shield-alert": ShieldAlert,
};

export interface ModuleIconResult {
  readonly Icon: LucideIcon;
  /** `true` when `iconReference` was `null` or didn't match any known value, so the caller can
   *  decide how to handle the fallback case itself — e.g. the sidebar's icon-only collapsed state
   *  falls back further, to a per-module monogram, so a module with no matching icon still looks
   *  visually distinct from every other module rather than collapsing onto one shared generic
   *  icon. */
  readonly isFallback: boolean;
}

/** Falls back to `LayoutGrid` for a module whose `iconReference` is `null` or not one of the 43
 *  known values — never throws, since this reads real backend data across a network boundary.
 *  Logs the miss (once it actually happens, not preemptively) so a future/renamed backend value
 *  this map hasn't caught up with is visible in server logs instead of silently degrading
 *  everywhere with no trace — the same "future value silently falls through" class of gap this
 *  project has caught and fixed elsewhere (e.g. `AuthErrorReason`'s `isKnownReason()`). */
export function moduleIcon(iconReference: string | null): ModuleIconResult {
  if (iconReference) {
    const Icon = ICON_MAP[iconReference];
    if (Icon) {
      return { Icon, isFallback: false };
    }
    console.error(`moduleIcon: unrecognized iconReference "${iconReference}", using fallback`);
  }
  return { Icon: LayoutGrid, isFallback: true };
}
