import { useLocale, type Locale } from "../i18n";

export default function LanguageSwitcher() {
    const { locale, setLocale } = useLocale();

    return (
        <select 
            value={locale()} 
            onChange={(e) => setLocale(e.currentTarget.value as Locale)}
            aria-label="Language"
        >
            <option value="en">English</option>
            <option value="es">Español</option>
        </select>
    );
}