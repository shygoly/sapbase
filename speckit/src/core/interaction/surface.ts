/**
 * 临时交互面（Interaction Surface）的运行时判据。
 *
 * 它不是页面、不是表单：不进导航、没有自己的 URL、不能被收藏。
 * 这些约束写在类型与返回值里，不是靠注释。
 */

export const INTERACTION_SURFACE_LIFETIME = 'session-only' as const

export type EphemeralSurfaceBinding = {
  readonly lifetime: typeof INTERACTION_SURFACE_LIFETIME
  readonly navigable: false
  readonly bookmarkable: false
  readonly href: null
}

export function bindEphemeralSurface(): EphemeralSurfaceBinding {
  return {
    lifetime: INTERACTION_SURFACE_LIFETIME,
    navigable: false,
    bookmarkable: false,
    href: null,
  }
}

export function canNavigateToSurface(
  _binding: EphemeralSurfaceBinding,
): false {
  return false
}

export function canBookmarkSurface(_binding: EphemeralSurfaceBinding): false {
  return false
}

export function surfaceHref(_binding: EphemeralSurfaceBinding): null {
  return null
}
