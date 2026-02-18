'use client'

import { useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { WorkflowDefinition, WorkflowState, WorkflowTransition } from '@/lib/api/workflows.api'

interface WorkflowStateDiagramProps {
  workflow: WorkflowDefinition
  currentState?: string
  onStateClick?: (state: string) => void
  onTransitionClick?: (transition: WorkflowTransition) => void
  interactive?: boolean
}

// Custom node component for states
function StateNode({ data }: { data: { state: WorkflowState; isCurrent: boolean } }) {
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
  workflow,
  currentState,
  onStateClick,
  onTransitionClick,
  interactive = true,
}: WorkflowStateDiagramProps) {
  const { nodes, edges } = useMemo(() => {
    // Calculate layout positions
    const stateNodes: Node[] = workflow.states.map((state, index) => {
      // Simple grid layout
      const cols = Math.ceil(Math.sqrt(workflow.states.length))
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

    const transitionEdges: Edge[] = workflow.transitions.map((transition, index) => ({
      id: `edge-${index}`,
      source: transition.from,
      target: transition.to,
      label: transition.guard ? `[${transition.guard}]` : '',
      type: 'smoothstep',
      animated: currentState === transition.from,
      style: {
        stroke: transition.guard ? '#888' : '#333',
        strokeWidth: 2,
      },
    }))

    return { nodes: stateNodes, edges: transitionEdges }
  }, [workflow, currentState])

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (onStateClick) {
      onStateClick(node.id)
    }
  }

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    if (onTransitionClick) {
      const transition = workflow.transitions.find(
        (t) => t.from === edge.source && t.to === edge.target,
      )
      if (transition) {
        onTransitionClick(transition)
      }
    }
  }

  if (!workflow.states || workflow.states.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No states defined</p>
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
