import { useLocale } from "./LocaleProvider.jsx";
import { formatLastUpdatedAt } from "./formatters.js";

export function LastUpdatedTime({
  className,
  timeZone,
  uploadedAt
}) {
  const { locale } = useLocale();
  const formatted = formatLastUpdatedAt(uploadedAt, locale, { timeZone });

  if (!formatted) return null;

  return (
    <time className={className} dateTime={formatted.dateTime}>
      {formatted.label}
    </time>
  );
}
