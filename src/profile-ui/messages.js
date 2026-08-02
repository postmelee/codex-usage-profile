export const DEFAULT_MESSAGE_ID = "common.error.generic";

export const MESSAGE_CATALOGS = Object.freeze({
  en: Object.freeze({
    "common.error.actionFailed": "Could not {action}.",
    "common.error.generic": "Something went wrong.",
    "common.loading": "Loading"
  }),
  ko: Object.freeze({
    "common.error.actionFailed": "{action} 작업을 완료하지 못했습니다.",
    "common.error.generic": "문제가 발생했습니다.",
    "common.loading": "불러오는 중"
  })
});

export function getMessageCatalog(locale) {
  return MESSAGE_CATALOGS[locale] ?? MESSAGE_CATALOGS.en;
}

export function getMessageIds(locale = "en") {
  return Object.freeze(Object.keys(getMessageCatalog(locale)).sort());
}
