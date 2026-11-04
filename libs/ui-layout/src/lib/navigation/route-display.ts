import { locales } from '../../i18n/config'

const RESERVED_SEGMENTS = new Set(['dashboard', 'shipping', 'reports', 'admin', 'system-settings'])

export function stripLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0 && (locales as readonly string[]).includes(segments[0])) {
    return '/' + segments.slice(1).join('/')
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

export function getLastMeaningfulSegment(pathname: string): string {
  const stripped = stripLocaleFromPath(pathname)
  const segments = stripped.split('/').filter(Boolean)
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (!RESERVED_SEGMENTS.has(segments[index])) {
      return segments[index]
    }
  }
  return segments[segments.length - 1] || ''
}

export function getShortDisplayPath(pathname: string): string {
  const segment = getLastMeaningfulSegment(pathname)
  return segment ? `/${segment}` : '/'
}

export function formatSegmentLabel(segment: string): string {
  if (!segment) return 'Overview'
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getRouteLabel(pathname: string): string {
  return formatSegmentLabel(getLastMeaningfulSegment(pathname))
}
