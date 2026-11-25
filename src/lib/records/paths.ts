import { decodeRecordRouteId } from './route-id';

export type RecordLocale = 'ko' | 'en';
const sections = ['search', 'seasons', 'players', 'records', 'compare', 'history', 'data'] as const;
export type ArchiveSection = 'home' | typeof sections[number] | 'game' | 'player';

export function recordHref(locale: RecordLocale, suffix = '') {
  return `/stat${locale === 'en' ? '/en' : ''}${suffix && suffix !== '/' ? `/${suffix.replace(/^\/+/, '')}` : ''}`;
}

export function recordLanguageHref(locale: RecordLocale, pathname: string, search = '') {
  const suffix = pathname.replace(/^\/stat(?:\/en)?(?=\/|$)/, '');
  return `${recordHref(locale === 'ko' ? 'en' : 'ko', suffix)}${search ? `?${search}` : ''}`;
}

export function resolveRecordPath(path: string[] = []): {
  locale: RecordLocale;
  section: ArchiveSection;
  canonicalPath: string;
  id?: string;
} | null {
  const locale = path[0] === 'en' ? 'en' : 'ko';
  const parts = locale === 'en' ? path.slice(1) : path;
  if (!parts.length) return { locale, section: 'home', canonicalPath: '' };
  if (parts.length === 1 && sections.includes(parts[0] as typeof sections[number])) {
    return { locale, section: parts[0] as typeof sections[number], canonicalPath: parts[0] };
  }
  if (parts.length === 2 && ['games', 'players'].includes(parts[0])) {
    const id = decodeRecordRouteId(parts[1]);
    if (id) return {
      locale,
      section: parts[0] === 'games' ? 'game' : 'player',
      canonicalPath: `${parts[0]}/${encodeURIComponent(id)}`,
      id,
    };
  }
  return null;
}

// Only archive addresses migrate. Fan services, API endpoints and the new home stay put.
export function legacyRecordPath(pathname: string): string | null {
  if (pathname === '/en' || pathname.startsWith('/en/')) return `/stat${pathname}`;
  if (sections.some(section => pathname === `/${section}`)) return `/stat${pathname}`;
  if (/^\/(players|games)\/[^/]+\/?$/.test(pathname)) return `/stat${pathname}`;
  return null;
}
