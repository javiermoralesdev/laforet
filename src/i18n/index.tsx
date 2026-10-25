import { createSignal, createMemo, createContext, useContext, type ParentComponent } from "solid-js";
import * as i18n from "@solid-primitives/i18n";
import { en } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";
const dictionaries = { en, es };

interface I18nContextType {
    t: i18n.Translator<typeof en>;
    locale: () => Locale;
    setLocale: (lang: Locale) => void;
}

const I18nContext = createContext<I18nContextType>();

// 1. Define a constant key for localStorage
const STORAGE_KEY = "diary_pref_lang";

// 2. Helper to get the saved language on load
const getInitialLocale = (): Locale => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Ensure the saved value is strictly one of our supported languages
    if (saved === "en" || saved === "es") {
        return saved;
    }
    // Default to English if nothing is saved or if the data is corrupted
    return "en"; 
};

export const I18nProvider: ParentComponent = (props) => {
    // 3. Initialize the signal using our helper
    const [locale, setLocaleSignal] = createSignal<Locale>(getInitialLocale());
    
    // 4. Wrap the setter to save to localStorage every time the user switches languages
    const setLocale = (lang: Locale) => {
        setLocaleSignal(lang);
        localStorage.setItem(STORAGE_KEY, lang);
    };
    
    const dict = createMemo(() => dictionaries[locale()]);
    const t = i18n.translator(dict);

    return (
        <I18nContext.Provider value={{ t, locale, setLocale }}>
            {props.children}
        </I18nContext.Provider>
    );
};

export const useLocale = () => {
    const context = useContext(I18nContext);
    if (!context) throw new Error("useLocale must be used within I18nProvider");
    return context;
};