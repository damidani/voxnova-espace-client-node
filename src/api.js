import { VoxNova, VoxNovaError, operations } from '@voxnova/sdk';
import { config } from './config.js';

/**
 * Accès à l'API par le SDK officiel (@voxnova/sdk), avec votre clé revendeur. La clé n'est jamais envoyée au navigateur.
 * vx()                       : au nom du revendeur (connexion des clients, création de compte…)
 * vx({ org, user })          : au nom d'un client et d'un de ses utilisateurs (en-têtes X-Organization et X-User)
 * Toutes les routes de l'API sont disponibles : vx(as).api.org.users.list(), vx(as).api.centrex.flows.simulate(…)…
 */

/** Erreur de l'API (celle du SDK) : message en français, statut HTTP, corps (détails des erreurs de validation dans body.details). */
export const ApiError = VoxNovaError;

// coupure réseau ou délai dépassé : erreur 503 lisible, comme une erreur de l'API
const safeFetch = async (url, init) => {
  try { return await fetch(url, init); } catch { throw new ApiError('Service momentanément indisponible, réessayez dans un instant.', 503, null); }
};

const root = config.apiKey ? new VoxNova({ apiKey: config.apiKey, baseUrl: config.apiUrl, timeoutMs: 20_000, fetch: safeFetch }) : null;

export function vx(as) {
  if (!root) throw new ApiError('Clé d’API manquante : renseignez API_KEY.', 401, null);
  let c = root;
  if (as?.org) c = c.forOrganization(as.org);
  if (as?.user) c = c.asUser(as.user);
  return c;
}

/** Opérations de l'API proposées aux clients dans « Toutes les fonctions » (jamais l'espace revendeur ni la connexion). */
export const clientOperations = operations.filter((o) => !o.path.startsWith('/api/reseller') && !o.path.startsWith('/api/auth') && (o.audiences.includes('client') || o.audiences.includes('developer')));

/** Téléchargement brut (PDF, CSV, audio) : le SDK renvoie du JSON, les fichiers passent par ici. */
export async function download(path, { as, query } = {}) {
  const url = new URL(config.apiUrl + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const headers = { Authorization: `Bearer ${config.apiKey}` };
  if (as?.org) headers['X-Organization'] = as.org;
  if (as?.user) headers['X-User'] = as.user;
  const res = await safeFetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.error ?? `Erreur ${res.status}`, res.status, data);
  }
  return res;
}

/** Envoi de fichier (multipart) : le corps reçu du navigateur est transmis tel quel. */
export async function upload(path, { as, body, contentType }) {
  const headers = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': contentType, Accept: 'application/json' };
  if (as?.org) headers['X-Organization'] = as.org;
  if (as?.user) headers['X-User'] = as.user;
  const res = await safeFetch(config.apiUrl + path, { method: 'POST', headers, body, signal: AbortSignal.timeout(120_000) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Erreur ${res.status}`, res.status, data);
  return data;
}
