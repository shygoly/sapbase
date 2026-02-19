import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { defaultLocale, isValidLocale, type Locale } from './i18n/config'

/**
 * Middleware to handle i18n routing.
 * Adds locale prefix to URLs and handles locale detection.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if pathname already has a locale
  const pathSegments = pathname.split('/').filter(Boolean)
  const firstSegment = pathSegments[0]
  const pathnameHasLocale = isValidLocale(firstSegment)

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // If pathname already has a locale, continue
  if (pathnameHasLocale) {
    const response = NextResponse.next()
    // Set locale cookie
    response.cookies.set('locale', firstSegment, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
    return response
  }

  // Paths that exist without locale prefix (app/login, app/auth, app/invitations)
  const noLocalePaths = ['/login', '/auth', '/invitations']
  const isNoLocalePath = noLocalePaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (isNoLocalePath) {
    return NextResponse.next()
  }

  // For root path "/" always redirect to default locale (/en/) so that
  // http://localhost:3050/ defaults to http://localhost:3050/en/
  const locale: Locale =
    pathname === '/'
      ? defaultLocale
      : (() => {
          const cookieLocale = request.cookies.get('locale')?.value
          if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale
          const acceptLanguage = request.headers.get('accept-language')
          if (acceptLanguage) {
            for (const lang of acceptLanguage.split(',').map((l) => l.split(';')[0].trim().toLowerCase())) {
              const code = lang.split('-')[0] as Locale
              if (isValidLocale(code)) return code
            }
          }
          return defaultLocale
        })()

  // Redirect to locale-prefixed path (e.g. / -> /en/, /foo -> /en/foo)
  const pathWithLocale = pathname === '/' ? `/${locale}/` : `/${locale}${pathname}`
  const newUrl = new URL(pathWithLocale, request.url)
  const response = NextResponse.redirect(newUrl)

  // Set locale cookie
  response.cookies.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
