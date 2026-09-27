'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SemanticEntity, SemanticState, SemanticTransition } from '@/lib/api/blueprints.api'
import { useTranslation } from '@/i18n'

interface WorkflowStateDiagramProps {
  entity: Pick<SemanticEntity, 'states' | 'transitions'>
  currentState?: string
  onStateClick?: (state: string) => void
  onTransitionClick?: (transition: SemanticTransition) => void
  interactive?: boolean
}

function StateNode({ data }: { data: { state: SemanticState; isCurrent: boolean } }) {
  const { state, isCurrent } = data
  const isInitial = state.initial
  const isFinal = state.final

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 min-w-[120px] text-center ${
        isCurrent
          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
          : isInitial
            ? 'border-green-500 bg-green-50 dark:bg-green-950'
            : isFinal
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 border-double'
              : 'border-gray-300 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="font-semibold">{state.name}</div>
      {isInitial && <div className="text-xs text-green-600 dark:text-green-400">START</div>}
      {isFinal && <div className="text-xs text-blue-600 dark:text-blue-400">END</div>}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  state: StateNode,
}

export function WorkflowStateDiagram({
  entity,
  currentState,
  onStateClick,
  onTransitionClick,
  interactive = true,
}: WorkflowStateDiagramProps) {
  const t = useTranslation()
  const { nodes, edges } = useMemo(() => {
    const stateNodes: Node[] = entity.states.map((state, index) => {
      const cols = Math.ceil(Math.sqrt(entity.states.length))
      const row = Math.floor(index / cols)
      const col = index % cols
      const x = col * 200 + 100
      const y = row * 150 + 100

      return {
        id: state.name,
        type: 'state',
        position: { x, y },
        data: {
          state,
          isCurrent: currentState === state.name,
        },
        draggable: interactive,
      }
    })

    const transitionEdges: Edge[] = entity.transitions.map((transition, index) => ({
      id: `edge-${index}`,
      source: transition.from,
      target: transition.to,
      type: 'smoothstep',
      animated: currentState === transition.from,
      style: {
        stroke: '#333',
        strokeWidth: 2,
      },
    }))

    return { nodes: stateNodes, edges: transitionEdges }
  }, [entity, currentState, interactive])

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (onStateClick) {
      onStateClick(node.id)
    }
  }

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    if (onTransitionClick) {
      const transition = entity.transitions.find(
        (item) => item.from === edge.source && item.to === edge.target,
      )
      if (transition) {
        onTransitionClick(transition)
      }
    }
  }

  if (!entity.states || entity.states.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">{t('workflows.noStates')}</p>
      </div>
    )
  }

  return (
    <div className="h-[600px] w-full border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
