'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { constantsApi } from '@/lib/api'
import type { YearParameterRecord } from '@/lib/api/shipping/types'
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
  year: z.coerce.number().min(2020, 'Year must be ≥ 2020').max(2100, 'Year must be ≤ 2100'),
  fuelEuTarget: z.coerce.number(),
  etsCoverageRatio: z.coerce.number().min(0).max(1),
  euaPrice: z.coerce.number().min(0, 'Must be ≥ 0'),
})

type FormData = z.infer<typeof formSchema>

interface YearFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editItem?: YearParameterRecord | null
}

export function YearFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editItem,
}: YearFormDialogProps) {
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
      year: new Date().getFullYear(),
      fuelEuTarget: 89,
      etsCoverageRatio: 0.7,
      euaPrice: 0.09,
    },
  })

  useEffect(() => {
    if (editItem) {
      reset({
        year: editItem.year,
        fuelEuTarget: editItem.fuelEuTarget,
        etsCoverageRatio: editItem.etsCoverageRatio,
        euaPrice: editItem.euaPrice,
      })
    } else {
      reset({
        year: new Date().getFullYear(),
        fuelEuTarget: 89,
        etsCoverageRatio: 0.7,
        euaPrice: 0.09,
      })
    }
  }, [editItem, open, reset])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      if (editItem) {
        await constantsApi.updateYear(editItem.id, data)
        notification.success('Year parameter updated successfully')
      } else {
        await constantsApi.createYear(data)
        notification.success('Year parameter created successfully')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      notification.error(err?.response?.data?.message || 'Failed to save year parameter')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Create'} Year Parameter</DialogTitle>
          <DialogDescription>
            Annual regulatory baselines and pricing parameters for shipping carbon calculations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              {...register('year')}
              disabled={!!editItem}
              placeholder="e.g. 2025"
            />
            {errors.year && (
              <p className="text-sm text-destructive mt-1">{errors.year.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="fuelEuTarget">FuelEU Target (%)</Label>
            <Input id="fuelEuTarget" type="number" step="any" {...register('fuelEuTarget')} />
          </div>
          <div>
            <Label htmlFor="etsCoverageRatio">ETS Coverage Ratio (0-1)</Label>
            <Input
              id="etsCoverageRatio"
              type="number"
              step="0.01"
              {...register('etsCoverageRatio')}
            />
            {errors.etsCoverageRatio && (
              <p className="text-sm text-destructive mt-1">{errors.etsCoverageRatio.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="euaPrice">EUA Price</Label>
            <Input id="euaPrice" type="number" step="any" {...register('euaPrice')} />
            {errors.euaPrice && (
              <p className="text-sm text-destructive mt-1">{errors.euaPrice.message}</p>
            )}
          </div>
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
