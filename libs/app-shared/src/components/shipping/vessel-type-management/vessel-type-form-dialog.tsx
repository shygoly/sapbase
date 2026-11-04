'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { constantsApi } from '../../../lib/api'
import type { CiiShipTypeParameterRecord } from '../../../lib/api/shipping/types'
import { useNotification } from '../../../core/ui/ui-hooks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
  shipType: z.string().min(1, 'Ship type is required'),
  applicableStandard: z.string().default('DWT'),
  rangeMin: z.coerce.number().min(0, 'Must be ≥ 0'),
  rangeMax: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  referenceCii: z.coerce.number(),
  requiredCii: z.coerce.number(),
  d1: z.coerce.number(),
  d2: z.coerce.number(),
  d3: z.coerce.number(),
  d4: z.coerce.number(),
  correctionFactor: z.coerce.number(),
})

type FormData = z.infer<typeof formSchema>

interface VesselTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editItem?: CiiShipTypeParameterRecord | null
}

export function VesselTypeFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editItem,
}: VesselTypeFormDialogProps) {
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
      applicableStandard: 'DWT',
      rangeMin: 0,
      rangeMax: undefined,
      referenceCii: 4.8,
      requiredCii: 4.5,
      d1: 0.82,
      d2: 0.93,
      d3: 1.08,
      d4: 1.28,
      correctionFactor: 1,
    },
  })

  useEffect(() => {
    if (editItem) {
      reset({
        shipType: editItem.shipType,
        applicableStandard: editItem.applicableStandard || 'DWT',
        rangeMin: editItem.rangeMin,
        rangeMax: editItem.rangeMax ?? undefined,
        referenceCii: editItem.referenceCii,
        requiredCii: editItem.requiredCii,
        d1: editItem.d1,
        d2: editItem.d2,
        d3: editItem.d3,
        d4: editItem.d4,
        correctionFactor: editItem.correctionFactor,
      })
    } else {
      reset({
        shipType: '',
        applicableStandard: 'DWT',
        rangeMin: 0,
        rangeMax: undefined,
        referenceCii: 4.8,
        requiredCii: 4.5,
        d1: 0.82,
        d2: 0.93,
        d3: 1.08,
        d4: 1.28,
        correctionFactor: 1,
      })
    }
  }, [editItem, open, reset])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        rangeMax: data.rangeMax === '' || data.rangeMax == null ? undefined : data.rangeMax,
      }
      if (editItem) {
        await constantsApi.updateCiiShipType(editItem.id, payload)
        notification.success('Vessel type updated successfully')
      } else {
        await constantsApi.createCiiShipType(payload as any)
        notification.success('Vessel type created successfully')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      notification.error(err?.response?.data?.message || 'Failed to save vessel type')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Create'} Vessel Type Parameter</DialogTitle>
          <DialogDescription>
            CII ship type parameters define reference values and rating bands.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shipType">Ship Type</Label>
              <Input id="shipType" {...register('shipType')} placeholder="e.g. Container" />
              {errors.shipType && (
                <p className="text-sm text-destructive mt-1">{errors.shipType.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="applicableStandard">Standard</Label>
              <Input id="applicableStandard" {...register('applicableStandard')} placeholder="DWT" />
            </div>
            <div>
              <Label htmlFor="rangeMin">Range Min</Label>
              <Input id="rangeMin" type="number" step="any" {...register('rangeMin')} />
              {errors.rangeMin && (
                <p className="text-sm text-destructive mt-1">{errors.rangeMin.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="rangeMax">Range Max (empty = no limit)</Label>
              <Input
                id="rangeMax"
                type="number"
                step="any"
                {...register('rangeMax')}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="referenceCii">Reference CII</Label>
              <Input id="referenceCii" type="number" step="any" {...register('referenceCii')} />
            </div>
            <div>
              <Label htmlFor="requiredCii">Required CII</Label>
              <Input id="requiredCii" type="number" step="any" {...register('requiredCii')} />
            </div>
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
