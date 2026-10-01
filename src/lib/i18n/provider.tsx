import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type Lang } from "./dictionary";

const STORAGE_KEY = "abdo.lang";

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Translate an English source string. Unknown keys fall back to the input. */
  t: (
    text: string,
    vars?: Record<string, string | number | null | undefined>,
  ) => string;
  /** Pick the Arabic label for a domain enum value, else return it unchanged. */
  pick: <T extends string>(value: T, map: Partial<Record<T, string>>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
    // First visit from an Arabic-speaking browser starts in Arabic.
    if (window.navigator.language?.toLowerCase().startsWith("ar")) return "ar";
  } catch {
    /* private mode — fall through to English */
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(
    () => setLangState((prev) => (prev === "ar" ? "en" : "ar")),
    [],
  );

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang];
    return {
      lang,
      dir,
      isRtl: dir === "rtl",
      setLang,
      toggleLang,
      t: (text, vars) => {
        let out = dict[text] ?? text;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            if (v === undefined || v === null) continue;
            out = out.split(`{${k}}`).join(String(v));
          }
        }
        return out;
      },
      pick: (value, map) => {
        const direct = dict[value];
        if (direct) return direct;
        const mapped = map[value];
        if (!mapped) return value;
        return dict[mapped] ?? mapped;
      },
    };
  }, [lang, dir, setLang, toggleLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

/** Shorthand for components that only need the translator. */
export function useT() {
  return useI18n().t;
}