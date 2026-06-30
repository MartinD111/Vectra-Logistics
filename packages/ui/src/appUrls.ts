// Cross-app URL resolution. Each app advertises its own base URL via env vars
// so links and the app-switcher work in dev (localhost:3000/3001/3002) and in
// prod (subdomains). Set NEXT_PUBLIC_MARKETPLACE_URL / _WORKSPACES_URL /
// _CMR_URL per environment.

export type VectraApp = 'marketplace' | 'workspaces' | 'cmr';

const DEV_DEFAULTS: Record<VectraApp, string> = {
  marketplace: 'http://localhost:3000',
  workspaces: 'http://localhost:3001',
  cmr: 'http://localhost:3002',
};

function envBase(app: VectraApp): string | undefined {
  if (typeof process === 'undefined') return undefined;
  switch (app) {
    case 'marketplace':
      return process.env.NEXT_PUBLIC_MARKETPLACE_URL;
    case 'workspaces':
      return process.env.NEXT_PUBLIC_WORKSPACES_URL;
    case 'cmr':
      return process.env.NEXT_PUBLIC_CMR_URL;
  }
}

export const appUrls: Record<VectraApp, string> = {
  marketplace: envBase('marketplace') ?? DEV_DEFAULTS.marketplace,
  workspaces: envBase('workspaces') ?? DEV_DEFAULTS.workspaces,
  cmr: envBase('cmr') ?? DEV_DEFAULTS.cmr,
};

/** Build an absolute URL into another app. `path` should start with "/". */
export function crossAppUrl(app: VectraApp, path = '/'): string {
  const base = appUrls[app].replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
