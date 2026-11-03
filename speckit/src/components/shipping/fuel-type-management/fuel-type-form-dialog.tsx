'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { constantsApi } from '@/lib/api'
import type { FuelTypeRecord } from '@/lib/api/shipping/types'
import { useNotification } from '@/core/ui/ui-hooks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  lcv: z.coerce.number(),
  co2Factor: z.coerce.number(),
  defaultPrice: z.coerce.number(),
  scope: z.enum(['system', 'tenant']).default('tenant'),
})

type FormData = z.infer<typeof formSchema>

interface FuelTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editItem?: FuelTypeRecord | null
}

export function FuelTypeFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editItem,
}: FuelTypeFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const notification = useNotification()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof formSchema>, unknown, FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scope: 'tenant',
      lcv: 40,
      co2Factor: 3.1,
      defaultPrice: 0,
    },
  })

  useEffect(() => {
    if (editItem) {
      reset({
        name: editItem.name,
        code: editItem.code ?? '',
        lcv: editItem.lcv,
        co2Factor: editItem.co2Factor,
        defaultPrice: editItem.defaultPrice ?? editItem.price ?? 0,
        scope: editItem.scope ?? 'tenant',
      })
    } else {
      reset({
        name: '',
        code: '',
        lcv: 40,
        co2Factor: 3.1,
        defaultPrice: 0,
        scope: 'tenant',
      })
    }
  }, [editItem, open, reset])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const payload = {
        name: data.name,
        code: data.code || undefined,
        lcv: data.lcv,
        wellToTankFactor: 14,
        tankToWakeFactor: 74,
        co2eqWtw: 0,
        co2Factor: data.co2Factor,
        gwpCo2: 1,
        gwpCh4: 28,
        gwpN2o: 265,
        slipFactor: 0,
        defaultPrice: data.defaultPrice,
        scope: data.scope,
      }
      if (editItem) {
        await constantsApi.updateFuelType(editItem.id, {
          name: data.name,
          code: data.code || undefined,
          lcv: data.lcv,
          co2Factor: data.co2Factor,
          defaultPrice: data.defaultPrice,
        })
        notification.success('Fuel type updated successfully')
      } else {
        await constantsApi.createFuelType(payload)
        notification.success('Fuel type created successfully')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      notification.error(err?.response?.data?.message || 'Failed to save fuel type')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Create'} Fuel Type</DialogTitle>
          <DialogDescription>
            {editItem?.scope === 'system'
              ? 'System fuel types are shared across organizations.'
              : 'Tenant fuel types are specific to your organization.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} placeholder="e.g. VLSFO" />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="code">Code (optional)</Label>
            <Input id="code" {...register('code')} placeholder="e.g. VLSFO" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lcv">LCV (MJ/kg)</Label>
              <Input id="lcv" type="number" step="any" {...register('lcv')} />
            </div>
            <div>
              <Label htmlFor="co2Factor">CO₂ Factor</Label>
              <Input id="co2Factor" type="number" step="any" {...register('co2Factor')} />
              {errors.co2Factor && (
                <p className="text-sm text-destructive mt-1">{errors.co2Factor.message}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="defaultPrice">Default Price (USD/t)</Label>
            <Input id="defaultPrice" type="number" step="any" {...register('defaultPrice')} />
          </div>
          {!editItem && (
            <div>
              <Label htmlFor="scope">Scope</Label>
              <select
                id="scope"
                {...register('scope')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="tenant">Tenant (organization-specific)</option>
                <option value="system">System (global)</option>
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
