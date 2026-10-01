import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import {
  FileText,
  Fingerprint,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  Plug,
  Settings,
  Sun,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

/** Route-specific titles that are not plain nav items. */
const EXTRA_TITLES: { test: RegExp; label: string }[] = [
  { test: /^\/dashboard\/scripts\/[^/]+\/publish$/, label: "Publish Kit" },
  { test: /^\/dashboard\/scripts\//, label: "Script Studio" },
];

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard, end: true },
  { to: "/dashboard/ideas", label: "Ideas", icon: Lightbulb },
  { to: "/dashboard/scripts", label: "Scripts", icon: FileText },
  { to: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { to: "/dashboard/style", label: "Style Profile", icon: Fingerprint },
  { to: "/dashboard/tools", label: "Tools", icon: Plug },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function currentTitle(pathname: string): string {
  const extra = EXTRA_TITLES.find((entry) => entry.test.test(pathname));
  if (extra) return extra.label;
  const match = NAV.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  );
  return match?.label ?? "Command Center";
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{t(item.label)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function BrandMark({ onClick }: { onClick?: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-start"
    >
      <img src={logo} alt="" className="size-8 rounded-lg" />
      <span className="flex flex-col leading-tight">
        <span dir="ltr" className="text-start text-sm font-semibold tracking-tight">
          ABDO CREATOR OS
        </span>
        <span className="text-[11px] text-muted-foreground">
          {t("Creator workspace")}
        </span>
      </span>
    </button>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const next = theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={next}
      title={next}
      className="size-8 text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}

function AccountBlock() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-2 border-t border-sidebar-border pt-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">
          {user?.name ?? user?.email ?? t("Creator")}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {user?.isAnonymous ? t("Guest session") : t("Signed in")}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        aria-label={t("Sign out")}
        onClick={async () => {
          await signOut();
          navigate("/");
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, isRtl } = useI18n();
  const title = t(currentTitle(location.pathname));

  return (
    <div className="flex min-h-screen w-full bg-background"
    >
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-e border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <div className="flex flex-col gap-6">
          <BrandMark onClick={() => navigate("/dashboard")} />
          <div className="flex flex-col gap-2">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("Workspace")}
            </p>
            <NavItems />
          </div>
          <div className="mx-3 rounded-lg border border-sidebar-border bg-card/50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Workflow className="size-3.5" />
              {t("Live pipeline")}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {t(
                "Idea → Angle → Script → Publish Kit is wired end to end. Research is not built, and nothing is ever uploaded to YouTube.",
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] text-muted-foreground">{t("Theme")}</span>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              <ThemeButton />
            </div>
          </div>
          <AccountBlock />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={isRtl ? "right" : "left"}
          className="w-72 border-sidebar-border bg-sidebar p-4"
        >
          <SheetTitle className="sr-only">{t("Navigation")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("Move between the creator workspace sections.")}
          </SheetDescription>
          <BrandMark
            onClick={() => {
              setMobileOpen(false);
              navigate("/dashboard");
            }}
          />
          <div className="mt-6">
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="mt-6">
            <AccountBlock />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("Open navigation")}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="text-sm font-semibold tracking-tight">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
