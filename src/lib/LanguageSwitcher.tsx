import { useLocale, type Locale } from "../i18n";

export default function LanguageSwitcher() {
    const { locale, setLocale } = useLocale();

    return (
        <select 
            value={locale()} 
            onChange={(e) => setLocale(e.currentTarget.value as Locale)}
            style={{
                padding: "0.4rem 0.8rem",
                "border-radius": "6px",
                border: "1px solid #ced4da",
                "background-color": "var(--surface-color)",
                color: "var(--text-main)",
                "font-weight": "500",
                cursor: "pointer",
                outline: "none"
            }}
        >
            <option value="en">English</option>
            <option value="es">Español</option>
        </select>
    );
}