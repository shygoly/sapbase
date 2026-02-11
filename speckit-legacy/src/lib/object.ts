// Object utility functions

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach((key) => {
    result[key] = obj[key]
  })
  return result
}

export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  keys.forEach((key) => {
    delete result[key]
  })
  return result
}

export function merge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  return sources.reduce<T>((acc, source) => {
    return { ...acc, ...source } as T
  }, { ...target } as T)
}

export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target }
  Object.keys(source).forEach((key) => {
    const sourceValue = source[key as keyof T]
    const targetValue = target[key as keyof T]

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key as keyof T] = deepMerge(targetValue, sourceValue)
    } else {
      result[key as keyof T] = sourceValue as any
    }
  })
  return result
}

export function isEmpty(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0
}

export function keys<T extends Record<string, any>>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[]
}

export function values<T extends Record<string, any>>(obj: T): T[keyof T][] {
  return Object.values(obj)
}

export function entries<T extends Record<string, any>>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}
