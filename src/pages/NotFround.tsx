import { useLocale } from "../i18n";

export default function NotFound() {
    const { t } = useLocale();
    
    return (
        <div>
            <h1>{t("not_found")}</h1>
        </div>
    );
}