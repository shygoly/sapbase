import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common'
import { CompileError } from '../blueprint/compiler'
import { LoadError } from '../blueprint/loader'
import { PackageError } from '../blueprint/packager'
import { locateConstraintField, type ConstraintFieldRef } from './db-constraints'

export class RecordWriteError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly field?: string,
    readonly ruleId?: string,
    readonly status?: number,
    readonly entity?: string,
    readonly value?: string,
  ) {
    super(message)
    this.name = 'RecordWriteError'
  }
}

export function driverCode(error: unknown): string | undefined {
  return (
    (error as { code?: string })?.code ??
    (error as { driverError?: { code?: string } })?.driverError?.code
  )
}

export function isUniqueViolation(error: unknown): boolean {
  return driverCode(error) === '23505'
}

export function isCheckViolation(error: unknown): boolean {
  return driverCode(error) === '23514'
}

function driverDetail(error: unknown): string | undefined {
  return (
    (error as { detail?: string })?.detail ??
    (error as { driverError?: { detail?: string } })?.driverError?.detail
  )
}

function driverConstraint(error: unknown): string | undefined {
  return (
    (error as { constraint?: string })?.constraint ??
    (error as { driverError?: { constraint?: string } })?.driverError?.constraint
  )
}

function extractValue(detail: string | undefined): string | undefined {
  if (!detail) return undefined
  const match = detail.match(/=\(([^)]+)\)/)
  return match?.[1]
}

export function mapConstraintError(
  error: unknown,
  locator: Map<string, ConstraintFieldRef>,
): RecordWriteError | null {
  const code = driverCode(error)
  if (code !== '23505' && code !== '23514') return null
  const name = driverConstraint(error)
  const located = locateConstraintField(locator, name)
  const value = extractValue(driverDetail(error))
  const entity = located?.entity
  const field = located?.field
  const where = entity && field ? `${entity}.${field}` : entity ?? field ?? name ?? 'unknown'
  const valueText = value ? `，值 ${value}` : ''
  if (code === '23505') {
    return new RecordWriteError(
      `唯一约束冲突：${where}${valueText}`,
      'unique-violation',
      field,
      undefined,
      undefined,
      entity,
      value,
    )
  }
  return new RecordWriteError(
    `非空约束冲突：${where}${valueText}`,
    'not-null-violation',
    field,
    undefined,
    undefined,
    entity,
    value,
  )
}

export function toHttpException(error: unknown): never {
  if (error instanceof RecordWriteError) {
    const body = {
      message: error.message,
      reason: error.reason,
      field: error.field,
      ruleId: error.ruleId,
      entity: error.entity,
      value: error.value,
    }
    if (error.status === 403) {
      throw new ForbiddenException(body)
    }
    if (error.status === 409 || error.reason === 'version-conflict') {
      throw new ConflictException(body)
    }
    throw new BadRequestException(body)
  }
  if (error instanceof LoadError) {
    throw new BadRequestException({ message: error.message, reason: error.reason })
  }
  if (error instanceof CompileError) {
    throw new BadRequestException({
      message: error.message,
      reason: error.reason,
      conflicts: error.conflicts,
    })
  }
  if (error instanceof PackageError) {
    throw new BadRequestException({ message: error.message, reason: error.reason })
  }
  if (error instanceof HttpException) {
    throw error
  }
  throw error
}
