import en from './en.json';
import ja from './ja.json';
import zhTW from './zh-TW.json';

export type SupportedLanguage = 'en' | 'zh-TW' | 'ja';
export type LanguagePreference = 'auto' | SupportedLanguage;

type Dictionary = Record<string, string>;
type Listener = () => void;

const STORAGE_KEY = 'tarot-overlay-language';
const dictionaries: Record<SupportedLanguage, Dictionary> = {
  en,
  'zh-TW': zhTW,
  ja,
};

const listeners = new Set<Listener>();
let preference: LanguagePreference = readStoredPreference();
let resolvedLanguage: SupportedLanguage = resolveLanguage(preference);

function readStoredPreference(): LanguagePreference {
  if (typeof window === 'undefined') {
    return 'auto';
  }
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === 'en' || value === 'zh-TW' || value === 'ja' || value === 'auto') {
    return value;
  }
  return 'auto';
}

function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  const languages = navigator.languages && navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  for (const language of languages) {
    if (language.startsWith('zh')) {
      return 'zh-TW';
    }
    if (language.startsWith('ja')) {
      return 'ja';
    }
    if (language.startsWith('en')) {
      return 'en';
    }
  }
  return 'en';
}

function resolveLanguage(value: LanguagePreference): SupportedLanguage {
  if (value === 'auto') {
    return detectBrowserLanguage();
  }
  return value;
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function getResolvedLanguage(): SupportedLanguage {
  return resolvedLanguage;
}

export function setLanguagePreference(value: LanguagePreference): void {
  preference = value;
  resolvedLanguage = resolveLanguage(value);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, value);
  }
  listeners.forEach((listener) => listener());
}

export function subscribeI18n(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function t(key: string, params?: Record<string, string | number>): string {
  const selected = dictionaries[resolvedLanguage][key] ?? dictionaries.en[key] ?? key;
  if (!params) {
    return selected;
  }
  return selected.replace(/\{(\w+)\}/g, (_match, token) => String(params[token] ?? `{${token}}`));
}
