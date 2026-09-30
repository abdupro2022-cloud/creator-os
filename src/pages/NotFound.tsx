import { Button } from "@/components/ui/button";
import { Compass, FileText, LayoutDashboard, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router";

/**
 * A dead end that is still part of the product.
 *
 * This used to be the template's bare 404: unstyled, no navigation, and on the
 * dark palette its grey-on-white text was nearly invisible, so a mistyped or
 * stale path looked exactly like a broken app. Every exit here is a real link
 * back into the workspace.
 */
const ESCAPES = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { to: "/dashboard/ideas", label: "Ideas", icon: Lightbulb },
  { to: "/dashboard/scripts", label: "Scripts", icon: FileText },
];

export default function NotFound() {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="surface-panel flex w-full max-w-md flex-col items-start gap-4 p-6"
      >
        <span className="flex items-center gap-2 text-primary">
          <Compass className="size-5" />
          <span className="text-[11px] font-semibold tracking-wider uppercase">
            Page not found
          </span>
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold tracking-tight">
            That screen does not exist
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing broke — this address simply is not part of the workspace.
            The page you asked for was not opened.
          </p>
        </div>

        <code className="w-full overflow-x-auto rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {location.pathname}
        </code>

        <div className="flex w-full flex-col gap-2">
          {ESCAPES.map((escape) => (
            <Button
              key={escape.to}
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <Link to={escape.to}>
                <escape.icon className="size-4" />
                {escape.label}
              </Link>
            </Button>
          ))}
        </div>
      </motion.div>
    </main>
  );
}
