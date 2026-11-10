import { NextResponse, type NextRequest } from 'next/server'
import { LOCALE_COOKIE } from '@sap/app-shared/i18n/config'
import { resolveLocaleRouting } from '@sap/ui-layout/i18n/locale-routing'

const ONE_YEAR = 60 * 60 * 24 * 365
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3050'
const canonicalRedirects: Record<string, string> = {
  '/': '/admin/releases',
  '/admin': '/admin/releases',
  '/admin/': '/admin/releases',
}

function redirectToPortal(request: NextRequest) {
  const target = new URL(request.nextUrl.pathname, PORTAL_URL)
  target.search = request.nextUrl.search
  return NextResponse.redirect(target)
}

function setLocaleCookie(response: NextResponse, locale: string) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

/**
 * Console 的 locale 归一化：
 *  - 旧 `/{locale}/...` → 307 去前缀，并把该 locale 写入 cookie；
 *  - `?lang=xx` → 写 cookie 后 307 去掉参数；
 *  - 静态资源与 API 不处理。
 */
export function middleware(request: NextRequest) {
  const decision = resolveLocaleRouting({
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
    canonical: canonicalRedirects,
  })

  if (decision.action === 'next') {
    // Console 没有 /dashboard/* 与 /docs/*；这些是 Portal 的路由。
    const pathname = request.nextUrl.pathname
    if (
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/') ||
      pathname === '/docs' ||
      pathname.startsWith('/docs/')
    ) {
      return redirectToPortal(request)
    }
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  if (decision.pathname) url.pathname = decision.pathname
  url.search = decision.search ? `?${decision.search}` : ''

  const response = NextResponse.redirect(url)
  if (decision.setCookie && decision.locale) {
    setLocaleCookie(response, decision.locale)
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|plugins|images).*)',
  ],
}
