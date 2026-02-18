'use client'

import React, { useCallback, useMemo, useState } from 'react'
import useMultistepForm from '@/hooks/use-multistep-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { aiModulesApi } from '@/lib/api/ai-modules.api'

const DEFINITION_STEP_IDS = [
  'object-model',
  'relationships',
  'state-flow',
  'pages',
  'permissions',
  'reports',
] as const

export interface NewModuleDefinitionState {
  objectModel: { entities?: string; notes?: string; generated?: Record<string, any> }
  relationships: { description?: string; generated?: Record<string, any> }
  stateFlow: { states?: string; notes?: string; generated?: Record<string, any> }
  pages: { description?: string; generated?: Record<string, any> }
  permissions: { rules?: string; generated?: Record<string, any> }
  reports: { description?: string; generated?: Record<string, any> }
}

const defaultState: NewModuleDefinitionState = {
  objectModel: {},
  relationships: {},
  stateFlow: {},
  pages: {},
  permissions: {},
  reports: {},
}

const STEP_LABELS = [
  'Object model',
  'Relationships',
  'State flow',
  'Pages',
  'Permissions',
  'Reports',
]

function GeneratedJsonPanel({ generated }: { generated?: Record<string, any> }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">本步骤生成结果</Label>
      <pre className="rounded-md border bg-muted/80 p-3 text-xs overflow-auto h-[320px] font-mono whitespace-pre-wrap break-words">
        {generated != null
          ? typeof generated === 'object'
            ? JSON.stringify(generated, null, 2)
            : String(generated)
          : '尚未生成结果。点击左侧 Generate 按钮后，JSON 会显示在这里。'}
      </pre>
    </div>
  )
}

function StepObjectModel({
  value,
  onChange,
  onGenerate,
  isGenerating,
  stepError,
  hasInput,
}: {
  value: NewModuleDefinitionState['objectModel']
  onChange: (v: NewModuleDefinitionState['objectModel']) => void
  onGenerate?: () => void
  isGenerating?: boolean
  stepError?: string | null
  hasInput?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Define object model</CardTitle>
        <CardDescription>Unified object model: entities and fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                'Generating…'
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  Generate from description
                </>
              )}
            </Button>
            {stepError && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {stepError}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Entities (e.g. Lead, Account, Opportunity, Contract)</Label>
              <Textarea
                placeholder="One per line or comma-separated"
                value={value.entities ?? ''}
                onChange={(e) => onChange({ ...value, entities: e.target.value })}
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional"
                value={value.notes ?? ''}
                onChange={(e) => onChange({ ...value, notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <GeneratedJsonPanel generated={value.generated} />
        </div>
      </CardContent>
    </Card>
  )
}

function StepRelationships({
  value,
  onChange,
  onGenerate,
  isGenerating,
  stepError,
  hasInput,
}: {
  value: NewModuleDefinitionState['relationships']
  onChange: (v: NewModuleDefinitionState['relationships']) => void
  onGenerate?: () => void
  isGenerating?: boolean
  stepError?: string | null
  hasInput?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Define relationships</CardTitle>
        <CardDescription>e.g. Lead → Account → Opportunity → Contract</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : <><Sparkles className="mr-1 h-4 w-4" /> Generate from description</>}
            </Button>
            {stepError && <span className="text-sm text-destructive">{stepError}</span>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Relationship description</Label>
            <p className="text-xs text-muted-foreground">Optional: leave empty to auto-generate from Step 1.</p>
            <Textarea
              placeholder="Describe entity relationships"
              value={value.description ?? ''}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              rows={12}
            />
          </div>
          <GeneratedJsonPanel generated={value.generated} />
        </div>
      </CardContent>
    </Card>
  )
}

function StepStateFlow({
  value,
  onChange,
  onGenerate,
  isGenerating,
  stepError,
  hasInput,
}: {
  value: NewModuleDefinitionState['stateFlow']
  onChange: (v: NewModuleDefinitionState['stateFlow']) => void
  onGenerate?: () => void
  isGenerating?: boolean
  stepError?: string | null
  hasInput?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Define state flow</CardTitle>
        <CardDescription>State machine DSL, e.g. draft → qualified → proposal → won → lost</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : <><Sparkles className="mr-1 h-4 w-4" /> Generate from description</>}
            </Button>
            {stepError && <span className="text-sm text-destructive">{stepError}</span>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>States and transitions</Label>
              <p className="text-xs text-muted-foreground">Optional: leave empty to auto-generate from previous steps.</p>
              <Textarea
                placeholder="List states and allowed transitions"
                value={value.states ?? ''}
                onChange={(e) => onChange({ ...value, states: e.target.value })}
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={value.notes ?? ''}
                onChange={(e) => onChange({ ...value, notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <GeneratedJsonPanel generated={value.generated} />
        </div>
      </CardContent>
    </Card>
  )
}

function StepPages({
  value,
  onChange,
  onGenerate,
  isGenerating,
  stepError,
  hasInput,
}: {
  value: NewModuleDefinitionState['pages']
  onChange: (v: NewModuleDefinitionState['pages']) => void
  onGenerate?: () => void
  isGenerating?: boolean
  stepError?: string | null
  hasInput?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Generate pages</CardTitle>
        <CardDescription>Page schema: lists, forms, detail views</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : <><Sparkles className="mr-1 h-4 w-4" /> Generate from description</>}
            </Button>
            {stepError && <span className="text-sm text-destructive">{stepError}</span>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Page description</Label>
            <p className="text-xs text-muted-foreground">Optional: leave empty to auto-generate from previous steps.</p>
            <Textarea
              placeholder="Describe pages to generate"
              value={value.description ?? ''}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              rows={12}
            />
          </div>
          <GeneratedJsonPanel generated={value.generated} />
        </div>
      </CardContent>
    </Card>
  )
}

function StepPermissions({
  value,
  onChange,
  onGenerate,
  isGenerating,
  stepError,
  hasInput,
}: {
  value: NewModuleDefinitionState['permissions']
  onChange: (v: NewModuleDefinitionState['permissions']) => void
  onGenerate?: () => void
  isGenerating?: boolean
  stepError?: string | null
  hasInput?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5: Permission rules</CardTitle>
        <CardDescription>e.g. sales: own only; manager: all; finance: contracts only</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : <><Sparkles className="mr-1 h-4 w-4" /> Generate from description</>}
            </Button>
            {stepError && <span className="text-sm text-destructive">{stepError}</span>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Permission rules</Label>
            <p className="text-xs text-muted-foreground">Optional: leave empty to auto-generate from previous steps.</p>
            <Textarea
              placeholder="Role and scope rules"
              value={value.rules ?? ''}
              onChange={(e) => onChange({ ...value, rules: e.target.value })}
              rows={12}
            />
          </div>
          <GeneratedJsonPanel generated={value.generated} />
        </div>
      </CardContent>
    </Card>
  )
}

function StepReports({
  value,
  onChange,
  onGenerate,
  isGenerating,
  stepError,
  hasInput,
}: {
  value: NewModuleDefinitionState['reports']
  onChange: (v: NewModuleDefinitionState['reports']) => void
  onGenerate?: () => void
  isGenerating?: boolean
  stepError?: string | null
  hasInput?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6: Generate reports</CardTitle>
        <CardDescription>Report definitions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {onGenerate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : <><Sparkles className="mr-1 h-4 w-4" /> Generate from description</>}
            </Button>
            {stepError && <span className="text-sm text-destructive">{stepError}</span>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Report description</Label>
            <p className="text-xs text-muted-foreground">Optional: leave empty to auto-generate from previous steps.</p>
            <Textarea
              placeholder="Describe reports to generate"
              value={value.description ?? ''}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              rows={12}
            />
          </div>
          <GeneratedJsonPanel generated={value.generated} />
        </div>
      </CardContent>
    </Card>
  )
}

export interface NewModuleDefinitionWizardProps {
  onComplete?: (state: NewModuleDefinitionState) => void
  onCancel?: () => void
}

function getStepUserInput(stepIndex: number, state: NewModuleDefinitionState): string {
  switch (stepIndex) {
    case 0:
      return [state.objectModel.entities, state.objectModel.notes].filter(Boolean).join('\n\n')
    case 1:
      return state.relationships.description ?? ''
    case 2:
      return [state.stateFlow.states, state.stateFlow.notes].filter(Boolean).join('\n\n')
    case 3:
      return state.pages.description ?? ''
    case 4:
      return state.permissions.rules ?? ''
    case 5:
      return state.reports.description ?? ''
    default:
      return ''
  }
}

function getStepHasInput(stepIndex: number, state: NewModuleDefinitionState): boolean {
  return getStepUserInput(stepIndex, state).trim().length > 0
}

const STEP_KEYS: (keyof NewModuleDefinitionState)[] = [
  'objectModel',
  'relationships',
  'stateFlow',
  'pages',
  'permissions',
  'reports',
]

/** Build context string from previous steps' generated data for the AI (step 0..before current). */
function getPreviousStepsContext(state: NewModuleDefinitionState, beforeStepIndex: number): string {
  const parts: string[] = []
  for (let i = 0; i < beforeStepIndex && i < STEP_LABELS.length; i++) {
    const key = STEP_KEYS[i]
    const stepData = state[key] as { generated?: Record<string, any> }
    if (stepData?.generated && Object.keys(stepData.generated).length > 0) {
      parts.push(
        `Step ${i + 1} - ${STEP_LABELS[i]}:\n${JSON.stringify(stepData.generated, null, 2)}`,
      )
    }
  }
  return parts.join('\n\n')
}

export function NewModuleDefinitionWizard({ onComplete, onCancel }: NewModuleDefinitionWizardProps) {
  const [state, setState] = useState<NewModuleDefinitionState>(defaultState)
  const [generatingStepIndex, setGeneratingStepIndex] = useState<number | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)

  const update = (key: keyof NewModuleDefinitionState, value: any) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const handleGenerate = useCallback(
    async (stepIndex: number) => {
      const stepId = DEFINITION_STEP_IDS[stepIndex]
      const userInput = getStepUserInput(stepIndex, state)
      const context = getPreviousStepsContext(state, stepIndex)
      if (!userInput.trim() && !context.trim()) return
      setGeneratingStepIndex(stepIndex)
      setStepError(null)
      try {
        const data = await aiModulesApi.generateDefinitionStep(
          stepId,
          userInput.trim(),
          context.trim() || undefined,
        )
        const key = STEP_KEYS[stepIndex]
        setState((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || {}), generated: data },
        }))
      } catch (err: any) {
        setStepError(err?.response?.data?.message ?? err?.message ?? 'Generation failed')
      } finally {
        setGeneratingStepIndex(null)
      }
    },
    [state],
  )

  const steps = useMemo(
    () => [
      <StepObjectModel
        key="1"
        value={state.objectModel}
        onChange={(v) => update('objectModel', v)}
        onGenerate={() => handleGenerate(0)}
        isGenerating={generatingStepIndex === 0}
        stepError={stepError}
        hasInput={getStepHasInput(0, state)}
      />,
      <StepRelationships
        key="2"
        value={state.relationships}
        onChange={(v) => update('relationships', v)}
        onGenerate={() => handleGenerate(1)}
        isGenerating={generatingStepIndex === 1}
        stepError={stepError}
        hasInput={getStepHasInput(1, state)}
      />,
      <StepStateFlow
        key="3"
        value={state.stateFlow}
        onChange={(v) => update('stateFlow', v)}
        onGenerate={() => handleGenerate(2)}
        isGenerating={generatingStepIndex === 2}
        stepError={stepError}
        hasInput={getStepHasInput(2, state)}
      />,
      <StepPages
        key="4"
        value={state.pages}
        onChange={(v) => update('pages', v)}
        onGenerate={() => handleGenerate(3)}
        isGenerating={generatingStepIndex === 3}
        stepError={stepError}
        hasInput={getStepHasInput(3, state)}
      />,
      <StepPermissions
        key="5"
        value={state.permissions}
        onChange={(v) => update('permissions', v)}
        onGenerate={() => handleGenerate(4)}
        isGenerating={generatingStepIndex === 4}
        stepError={stepError}
        hasInput={getStepHasInput(4, state)}
      />,
      <StepReports
        key="6"
        value={state.reports}
        onChange={(v) => update('reports', v)}
        onGenerate={() => handleGenerate(5)}
        isGenerating={generatingStepIndex === 5}
        stepError={stepError}
        hasInput={getStepHasInput(5, state)}
      />,
    ],
    [state, generatingStepIndex, stepError, handleGenerate],
  )

  const { currentStepIndex, step, isFirstStep, isLastStep, next, back } = useMultistepForm(steps)

  const handleFinish = () => {
    onComplete?.(state)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {STEP_LABELS.length}: {STEP_LABELS[currentStepIndex]}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {!isFirstStep && (
            <Button type="button" variant="outline" onClick={back}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          {!isLastStep ? (
            <Button type="button" onClick={next}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleFinish}>
              Finish definition
            </Button>
          )}
        </div>
      </div>
      {step}
    </div>
  )
}
