// src/consent-core.mjs
export const STORAGE_KEY = 'wt_consent';
// Duree de conservation du choix de consentement : 6 mois.
// (Le bandeau est de nouveau propose passe ce delai.)
export const CONSENT_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export function readConsent(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.timestamp) || !parsed.choices || typeof parsed.choices.analytics !== 'boolean') return null;
    return parsed;
  } catch { return null; }
}

export function writeConsent(storage, choices, now) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ choices, timestamp: now }));
}

export function isExpired(stored, now) {
  return !Number.isFinite(stored.timestamp) || stored.timestamp > now || now - stored.timestamp > CONSENT_TTL_MS;
}

export function isGpcDenied(nav) {
  return Boolean(nav && nav.globalPrivacyControl);
}

export function resolveConsentState({ stored, now, nav }) {
  if (isGpcDenied(nav)) return 'denied';
  if (!stored) return 'unknown';
  if (isExpired(stored, now)) return 'unknown';
  return stored.choices && stored.choices.analytics === true ? 'granted' : 'denied';
}

export function consentModeSignals(state) {
  const v = state === 'granted' ? 'granted' : 'denied';
  return {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: v,
    functionality_storage: 'granted',
    security_storage: 'granted',
  };
}
