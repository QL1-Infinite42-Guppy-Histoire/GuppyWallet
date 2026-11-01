import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DICT, setCurrentLang, type I18nKey, type Lang } from "../i18n";

/**
 * JA/EN language state, persisted across launches (AsyncStorage).
 * Default: Japanese. All user-facing text goes through src/i18n.ts;
 * the current language is also mirrored into the i18n module so lib
 * code can localize via tr().
 */

const STORAGE_KEY = "zaphod.lang";

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: I18nKey) => string;
}

const Ctx = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ja");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "en" || v === "ja") {
          setLangState(v);
          setCurrentLang(v);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setCurrentLang(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: I18nKey) => DICT[lang][key] ?? DICT.ja[key] ?? key,
    [lang],
  );

  const value = useMemo<LanguageState>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): LanguageState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
