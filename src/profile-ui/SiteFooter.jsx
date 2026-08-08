import { BrandLogo } from "./BrandLogo.jsx";
import { useLocale } from "./LocaleProvider.jsx";

export const PROJECT_LICENSE_URL =
  "https://github.com/postmelee/codex-usage-profile/blob/main/LICENSE";

export function SiteFooter({ githubUrl }) {
  const { t } = useLocale();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-about">
          <p className="site-footer-brand">{t("app.brand")}</p>
          <p>{t("footer.description")}</p>
          <p className="site-footer-privacy">{t("footer.privacy")}</p>
        </div>

        <div className="site-footer-meta">
          <nav aria-label={t("footer.linksLabel")} className="site-footer-links">
            <a href={githubUrl} rel="noopener noreferrer" target="_blank">
              <BrandLogo name="github" size={14} />
              <span>{t("common.nav.github")}</span>
            </a>
            <a href={PROJECT_LICENSE_URL} rel="noopener noreferrer" target="_blank">
              {t("footer.license")}
            </a>
          </nav>
          <p className="site-footer-copyright">{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
