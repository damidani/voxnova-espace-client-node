/** Configuration (variables d'environnement, voir .env.example). */
const env = (name, fallback = '') => (process.env[name] ?? fallback).trim();

export const config = {
  apiUrl: env('API_URL', 'https://api.hcloud.fr').replace(/\/$/, ''),
  apiKey: env('API_KEY'),
  brand: {
    name: env('BRAND_NAME', 'Espace client'),
    color: /^#[0-9a-f]{6}$/i.test(env('BRAND_COLOR')) ? env('BRAND_COLOR') : '#4f46e5',
    logoUrl: env('BRAND_LOGO_URL'),
    supportEmail: env('SUPPORT_EMAIL'),
    supportPhone: env('SUPPORT_PHONE'),
  },
  publicUrl: env('PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, ''),
  sessionSecret: env('SESSION_SECRET'),
  port: Number(env('PORT', '3000')),
  allowSignup: env('ALLOW_SIGNUP') === 'true',
  trialDays: Math.min(60, Math.max(0, Number(env('SIGNUP_TRIAL_DAYS', '14')) || 14)),
  production: process.env.NODE_ENV === 'production' || /^https:/.test(env('PUBLIC_URL')),
};

export function checkConfig() {
  const errors = [];
  if (!/^vxr_/.test(config.apiKey)) errors.push('API_KEY : clé revendeur vxr_… requise');
  if (config.sessionSecret.length < 32) errors.push('SESSION_SECRET : 32 caractères au moins (openssl rand -hex 32)');
  return errors;
}
