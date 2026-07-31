import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'en' | 'ar';

type Dict = Record<string, string>;

const dictionaries: Record<Locale, Dict> = {
  en: {
    'nav.home': 'Home',
    'nav.features': 'Features',
    'nav.pricing': 'Pricing',
    'nav.curriculum': 'Curriculum',
    'nav.tutors': 'Tutors',
    'nav.contact': 'Contact',
    'cta.demo': 'Book a demo',
    'cta.login': 'Portal sign in',
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.features': 'المزايا',
    'nav.pricing': 'الأسعار',
    'nav.curriculum': 'المنهج',
    'nav.tutors': 'المعلمون',
    'nav.contact': 'تواصل',
    'cta.demo': 'احجز عرضاً',
    'cta.login': 'دخول البوابة',
  },
};

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initial = 'en' }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial);
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocale(next);
        document.documentElement.lang = next;
        document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      },
      t: (key) => dictionaries[locale][key] ?? key,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
    }),
    [locale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
