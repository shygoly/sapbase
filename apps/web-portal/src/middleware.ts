import { NextResponse, type NextRequest } from 'next/server'
import { LOCALE_COOKIE } from '@sap/app-shared/i18n/config'
import { resolveLocaleRouting } from '@sap/ui-layout/i18n/locale-routing'

const ONE_YEAR = 60 * 60 * 24 * 365
const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL || 'http://localhost:3060'
const canonicalRedirects: Record<string, string> = {
  '/': '/dashboard/overview',
  '/dashboard': '/dashboard/overview',
  '/dashboard/': '/dashboard/overview',
  '/profile': '/dashboard/profile',
}

function redirectToConsole(request: NextRequest) {
  const target = new URL(
    request.nextUrl.pathname === '/admin' ? '/admin/releases' : request.nextUrl.pathname,
    CONSOLE_URL,
  )
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
 * Portal 的 locale 归一化：
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
    // Portal 没有 /admin/*；这是 Console 的路由，跨台面重定向。
    if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')) {
      return redirectToConsole(request)
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
