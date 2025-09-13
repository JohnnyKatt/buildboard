import Constants from 'expo-constants';

// GA4 Measurement Protocol minimal client
// Requires env: EXPO_PUBLIC_GA4_MEASUREMENT_ID, EXPO_PUBLIC_GA4_API_SECRET
const MEASUREMENT_ID = process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID;
const API_SECRET = process.env.EXPO_PUBLIC_GA4_API_SECRET;

function getClientId() {
  try {
    const id = (Constants as any).deviceId || `${Math.random().toString(36).slice(2)}.${Date.now()}`;
    return String(id);
  } catch {
    return `${Math.random().toString(36).slice(2)}.${Date.now()}`;
  }
}

async function sendGA4(eventName: string, params: Record<string, any> = {}) {
  if (!MEASUREMENT_ID || !API_SECRET) {
    // No-op if not configured
    console.log('[analytics noop]', eventName, params);
    return;
  }
  try {
    const body = {
      client_id: getClientId(),
      events: [
        {
          name: eventName,
          params,
        },
      ],
    };
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  } catch (e) {
    console.warn('[analytics error]', e);
  }
}

export function trackWaitlistSubmit(params: { role?: string; utm_source?: string | null; utm_campaign?: string | null; utm_medium?: string | null; }) {
  const p = { ...params } as any;
  if (p.utm_source == null) delete p.utm_source;
  if (p.utm_campaign == null) delete p.utm_campaign;
  if (p.utm_medium == null) delete p.utm_medium;
  return sendGA4('waitlist_submit', p);
}

export function trackReferralSubmit(params: { referral_type?: string; utm_source?: string | null; utm_campaign?: string | null; utm_medium?: string | null; }) {
  const p = { ...params } as any;
  if (p.utm_source == null) delete p.utm_source;
  if (p.utm_campaign == null) delete p.utm_campaign;
  if (p.utm_medium == null) delete p.utm_medium;
  return sendGA4('referral_submit', p);
}

export function trackOutboundInstagram(params?: { location?: 'header' | 'footer' | 'thankyou' }) {
  return sendGA4('outbound_click_instagram', params || {});
}

export function trackWaitlistSuccessModalShown() {
  return sendGA4('waitlist_success_modal_shown', {});
}

export function trackReferralSuccessModalShown() {
  return sendGA4('referral_success_modal_shown', {});
}