import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { Languages } from "lucide-react";

/**
 * Language switch.
 *
 * The label always shows the language you would move TO, not the one you are
 * currently reading in — that is what makes the button predictable for someone
 * who cannot read the current language at all.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, toggleLang, t } = useI18n();
  const nextLabel = lang === "ar" ? "EN" : "ع";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLang}
      aria-label={t(lang === "ar" ? "Switch to English" : "Switch to Arabic")}
      title={t(lang === "ar" ? "Switch to English" : "Switch to Arabic")}
      className={`h-8 gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground ${className ?? ""}`}
    >
      <Languages className="size-4" />
      <span dir={lang === "ar" ? "ltr" : "rtl"}>{nextLabel}</span>
    </Button>
  );
}