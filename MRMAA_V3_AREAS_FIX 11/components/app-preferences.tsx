"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate, type AppLanguage } from "@/lib/translations";

export type AppCurrency = "GTQ" | "USD" | "MXN";
type Preferences = {
  language: AppLanguage;
  currency: AppCurrency;
  setPreferences: (language: unknown, currency: unknown) => void;
  t: (value: unknown) => string;
  money: (value: number) => string;
};

const LANGUAGE_KEY = "mrmaa-language";
const CURRENCY_KEY = "mrmaa-currency";
let activeLanguage: AppLanguage = "es";
let activeCurrency: AppCurrency = "GTQ";

export const appLanguage = (value: unknown): AppLanguage => value === "en" ? "en" : "es";
export const appCurrency = (value: unknown): AppCurrency =>
  value === "USD" || value === "MXN" ? value : "GTQ";

export function formatAppMoney(value: number, currency = activeCurrency, language = activeLanguage) {
  const locale = language === "en"
    ? currency === "MXN" ? "en-MX" : currency === "GTQ" ? "en-GT" : "en-US"
    : currency === "MXN" ? "es-MX" : "es-GT";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function currentAppLanguage() { return activeLanguage; }
export function currentAppCurrency() { return activeCurrency; }
export function appLocale(language = activeLanguage) {
  return language === "en" ? "en-US" : "es-GT";
}
export function formatAppDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(appLocale(), options).format(new Date(value));
}

const AppPreferencesContext = createContext<Preferences>({
  language: "es",
  currency: "GTQ",
  setPreferences: () => undefined,
  t: (value) => String(value ?? ""),
  money: (value) => formatAppMoney(value),
});

function translateElement(root: ParentNode, language: AppLanguage) {
  const owner = root instanceof Document ? root : root.ownerDocument;
  if (!owner) return;
  const walker = owner.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && !parent.closest("script,style,textarea,code,pre,[contenteditable='true']")) {
      const original = node.nodeValue || "";
      const trimmed = original.trim();
      if (trimmed) {
        const translated = translate(trimmed, language);
        if (translated !== trimmed)
          node.nodeValue = original.replace(trimmed, translated);
      }
    }
    node = walker.nextNode();
  }
  const elements: Element[] = [];
  if (root instanceof Element) elements.push(root);
  elements.push(...Array.from(root.querySelectorAll("[placeholder],[title],[aria-label]")));
  for (const element of elements)
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      const original = element.getAttribute(attribute);
      if (!original) continue;
      const translated = translate(original, language);
      if (translated !== original) element.setAttribute(attribute, translated);
    }
}

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("es");
  const [currency, setCurrency] = useState<AppCurrency>("GTQ");

  useEffect(() => {
    const storedLanguage = appLanguage(localStorage.getItem(LANGUAGE_KEY));
    const storedCurrency = appCurrency(localStorage.getItem(CURRENCY_KEY));
    activeLanguage = storedLanguage;
    activeCurrency = storedCurrency;
    setLanguage(storedLanguage);
    setCurrency(storedCurrency);
  }, []);

  const setPreferences = useCallback((nextLanguage: unknown, nextCurrency: unknown) => {
    const safeLanguage = appLanguage(nextLanguage);
    const safeCurrency = appCurrency(nextCurrency);
    activeLanguage = safeLanguage;
    activeCurrency = safeCurrency;
    localStorage.setItem(LANGUAGE_KEY, safeLanguage);
    localStorage.setItem(CURRENCY_KEY, safeCurrency);
    // Translating the complete dashboard can touch many labels. Mark the
    // provider update as non-urgent so the select/control paints immediately.
    startTransition(() => {
      setLanguage(safeLanguage);
      setCurrency(safeCurrency);
    });
  }, []);

  activeLanguage = language;
  activeCurrency = currency;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = "MRMAA";
    translateElement(document.body, language);
    const pending = new Set<ParentNode>();
    let frame = 0;
    const flush = () => {
      frame = 0;
      const roots = Array.from(pending);
      pending.clear();
      for (const root of roots) translateElement(root, language);
    };
    const queue = (root: ParentNode) => {
      pending.add(root);
      if (!frame) frame = window.requestAnimationFrame(flush);
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentNode)
          queue(mutation.target.parentNode);
        for (const node of Array.from(mutation.addedNodes))
          if (node instanceof Element) queue(node);
          else if (node.parentNode) queue(node.parentNode);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      pending.clear();
    };
  }, [language]);

  const value = useMemo<Preferences>(() => ({
    language,
    currency,
    setPreferences,
    t: (text) => translate(text, language),
    money: (amount) => formatAppMoney(amount, currency, language),
  }), [language, currency, setPreferences]);

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  return useContext(AppPreferencesContext);
}
