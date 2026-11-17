import { config } from './config.js';

/** Erreur renvoyée par l'API (message en français dans `message`). */
export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

/**
 * Appel de l'API avec la clé revendeur. `as` : { org, user } pour agir au nom d'un client et d'un de ses utilisateurs
 * (en-têtes X-Organization et X-User). La clé n'est jamais envoyée au navigateur.
 */
export async function api(method, path, { body, query, as, raw } = {}) {
  const url = new URL(config.apiUrl + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const headers = { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' };
  if (as?.org) headers['X-Organization'] = as.org;
  if (as?.user) headers['X-User'] = as.user;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(503, 'Service momentanément indisponible, réessayez dans un instant.');
  }
  if (raw && res.ok) return res;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Erreur ${res.status}`, Array.isArray(data?.details) ? data.details : undefined);
  return data;
}
