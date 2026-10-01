import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { useI18n } from "@/lib/i18n/provider";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import logo from "@/assets/logo.svg";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Compass,
  Fingerprint,
  Film,
  Gamepad2,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Moon,
  PenLine,
  Rocket,
  Route,
  ScanSearch,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router";

const PIPELINE: {
  label: string;
  icon: typeof Lightbulb;
  live: boolean;
  note?: string;
}[] = [
  { label: "Idea", icon: Lightbulb, live: true },
  { label: "Research", icon: Search, live: true, note: "Needs a research key" },
  { label: "Angle", icon: Compass, live: true },
  { label: "Script", icon: PenLine, live: true },
  { label: "Shorts", icon: Film, live: true, note: "Cut plan" },
  { label: "SEO", icon: TrendingUp, live: true, note: "Metadata kit" },
  { label: "Publish", icon: Rocket, live: true, note: "No upload" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Idea development that labels its claims",
    body: "A raw spark becomes a working title, an angle, a spoken hook and key points — each labelled FACT, INFERENCE, AI SUGGESTION or UNVERIFIED, with the risky ones pulled into a separate list.",
  },
  {
    icon: Route,
    title: "Capability-based model routing",
    body: "Tasks declare what they need (structured output, reasoning, speed). The router picks a model across OpenAI, Anthropic, Google, DeepSeek, Kimi and MiniMax, and falls back automatically when one is unavailable.",
  },
  {
    icon: PenLine,
    title: "Script Studio, not a textarea",
    body: "Outline first, then one model call per section written straight into the database. Real word counts, a narration estimate from your pacing, per-section rewrites, reordering and revisions.",
  },
  {
    icon: ScanSearch,
    title: "Verification you can trust",
    body: "A deterministic scan checks structure, prohibited style, filler openers and unsourced evidence claims. Then a model review pass runs and both sets of findings are stored on the script.",
  },
  {
    icon: Fingerprint,
    title: "Your voice, enforced",
    body: "Language, dialect, tone, pacing, storytelling, hooks and prohibited styles are injected into every prompt — and the page shows the exact text the model receives.",
  },
  {
    icon: Boxes,
    title: "Projects keep context apart",
    body: "Every idea, script and agent run belongs to one project, so a second channel never inherits the first one's angle, voice or history.",
  },
] as const;

const ROADMAP = [
  "YouTube competitor analysis",
  "Files, PDFs and retrieval",
  "Long-term memory and background tasks",
] as const;

function Nav() {
  const { isAuthenticated } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="" className="size-8 rounded-lg" />
          <span className="flex flex-col leading-tight">
            <span
              dir="ltr"
              className="text-start text-sm font-semibold tracking-tight"
            >
              ABDO CREATOR OS
            </span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              {t("Personal creator workspace")}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#pipeline" className="transition-colors hover:text-foreground">
            {t("Pipeline")}
          </a>
          <a href="#works" className="transition-colors hover:text-foreground">
            {t("What works")}
          </a>
          <a href="#roadmap" className="transition-colors hover:text-foreground">
            {t("Roadmap")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={t(theme === "dark" ? "Switch to light mode" : "Switch to dark mode")}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <LanguageToggle />
          {isAuthenticated ? (
            <Button type="button" size="sm" className="gap-2" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="size-4" />
                {t("Workspace")}
              </Link>
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/auth">{t("Sign in")}</Link>
              </Button>
              <Button type="button" size="sm" className="gap-2" asChild>
                <Link to="/auth">
                  {t("Get started")}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PipelineStrip() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PIPELINE.map((stage) => (
        <span
          key={stage.label}
          className={
            stage.live
              ? "flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-2.5 py-1.5 text-xs font-medium text-foreground"
              : "flex items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground"
          }
        >
          <stage.icon
            className={stage.live ? "size-3.5 text-primary" : "size-3.5"}
          />
          {t(stage.label)}
          {stage.live && stage.note ? (
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase opacity-80">
              {t(stage.note)}
            </span>
          ) : null}
          {!stage.live ? (
            <span className="text-[10px] tracking-wide uppercase opacity-70">
              {t("later")}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col bg-background"
    >
      <Nav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 grid-backdrop opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex max-w-3xl flex-col gap-6"
            >
              <span className="flex w-fit items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <Gamepad2 className="size-3.5 text-primary" />
                {t("Personal AI operating system for one creator")}
              </span>

              <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
                {t("From a raw idea to a script you can actually film.")}
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t(
                  "ABDO CREATOR OS is a working creator workspace, not a chat wrapper. Capture a spark, let the agent develop the angle with every claim labelled, then draft a real script section by section — with word counts, a duration estimate, verification findings and revisions.",
                )}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="lg" className="gap-2" asChild>
                  <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
                    {t(isAuthenticated ? "Open the workspace" : "Start building")}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  asChild
                >
                  <a href="#pipeline">{t("See the pipeline")}</a>
                </Button>
              </div>

              <ul className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {[
                  "No fabricated sources or statistics",
                  "No exposed chain-of-thought",
                  "API keys never reach the browser",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        {/* Pipeline */}
        <section
          id="pipeline"
          className="border-y border-border/70 bg-surface/40"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {t("The pipeline, honestly labelled")}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "Idea → research → angle → script → publish kit ships end to end. Every stage below is labelled with the exact boundary it has — a plan is not a product.",
                  )}
                </p>
              </div>
              <PipelineStrip />
            </div>
          </div>
        </section>

        {/* Three steps */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Capture",
                body: "Write the thought the way you would say it. It is stored before any model runs, so nothing is lost if a provider fails.",
              },
              {
                step: "02",
                title: "Develop",
                body: "The agent returns a title, angle, spoken hook, audience and labelled key points — plus a list of claims that still need a real source.",
              },
              {
                step: "03",
                title: "Draft",
                body: "An outline is validated against your target length, then each section is written into Script Studio where you edit, rewrite and verify it.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                className="surface-panel flex flex-col gap-2 p-5"
              >
                <span className="font-mono text-xs text-primary">{item.step}</span>
                <h3 className="text-base font-semibold tracking-tight">
                  {t(item.title)}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(item.body)}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* What works */}
        <section
          id="works"
          className="border-y border-border/70 bg-surface/40"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {t("What is actually implemented")}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {t(
                  "Every item below runs against a real database and real model calls. Nothing on this page is a mock-up.",
                )}
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
                  className="surface-panel flex flex-col gap-2.5 p-5"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <feature.icon className="size-4 text-primary" />
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {t(feature.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(feature.body)}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap + architecture */}
        <section id="roadmap" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35 }}
              className="surface-panel flex flex-col gap-3 p-5"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                {t("Not built yet — and listed as such")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(
                  "These modules are designed but deliberately excluded from version 1. There are no placeholder buttons and no fake data for them anywhere in the app.",
                )}
              </p>
              <ul className="mt-1 flex flex-col gap-2">
                {ROADMAP.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: 0.06 }}
              className="surface-panel flex flex-col gap-3 p-5"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                {t("How it is put together")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(
                  "A modular stack, so a new tool or provider is an addition rather than a rewrite.",
                )}
              </p>
              <pre
                dir="ltr"
                className="overflow-x-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-start text-[11px] leading-relaxed"
              >
{`Frontend (Vite + React)
   ↓
Convex API  ·  queries / mutations / actions
   ↓
Agent core  ·  Plan → Route → Execute → Verify
   ↓
Tool registry  ·  AI providers  ·  Settings
   ↓
Database  ·  projects, ideas, scripts, runs`}
              </pre>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Lock className="size-3.5 text-success" />
                  {t("Keys are read server-side only, in the Convex Node runtime.")}
                </li>
                <li className="flex items-center gap-2">
                  <ScanSearch className="size-3.5 text-success" />
                  {t(
                    "External content is treated as untrusted data, never as instructions.",
                  )}
                </li>
              </ul>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/70 bg-surface/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("Open the workspace and turn one idea into a script tonight.")}
            </h2>
            <Button type="button" size="lg" className="gap-2" asChild>
              <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
                {t(
                  isAuthenticated
                    ? "Back to the Command Center"
                    : "Create your workspace",
                )}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>{t("ABDO CREATOR OS — a personal creator operating system.")}</span>
          <span>
            {t("Built on Convex, React and a provider-agnostic AI gateway.")}
          </span>
        </div>
      </footer>
    </motion.div>
  );
}
