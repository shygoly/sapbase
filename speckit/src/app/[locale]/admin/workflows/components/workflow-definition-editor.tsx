'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SemanticEntity } from '@/lib/api/blueprints.api'
import { useTranslation } from '@/i18n'

interface WorkflowDefinitionEditorProps {
  entity: SemanticEntity
}

/** 只读定义查看：状态 + 迁移列表，数据来自 GET /blueprints/:id/semantic。 */
export function WorkflowDefinitionEditor({ entity }: WorkflowDefinitionEditorProps) {
  const t = useTranslation()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground">{t('workflows.entity')}</div>
          <div className="mt-1 font-medium">{entity.name}</div>
        </div>
        {entity.children && entity.children.length > 0 && (
          <div>
            <div className="text-sm font-medium text-muted-foreground">{t('workflows.children')}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {entity.children.map((child) => (
                <Badge key={child} variant="outline">
                  {child}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.states')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entity.states.map((state) => (
              <div key={state.name} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">{state.name}</span>
                <div className="flex items-center gap-2">
                  {state.initial && <Badge variant="default">{t('workflows.initial')}</Badge>}
                  {state.final && <Badge variant="secondary">{t('workflows.final')}</Badge>}
                </div>
              </div>
            ))}
            {entity.states.length === 0 && (
              <div className="text-center text-muted-foreground py-4">{t('workflows.noStates')}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.transitions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entity.transitions.map((transition, index) => (
              <div key={`${transition.from}-${transition.to}-${index}`} className="flex items-center gap-2 p-3 border rounded-lg">
                <Badge>{transition.from}</Badge>
                <span>→</span>
                <Badge>{transition.to}</Badge>
              </div>
            ))}
            {entity.transitions.length === 0 && (
              <div className="text-center text-muted-foreground py-4">{t('workflows.noTransitions')}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
