import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorkflowHistory } from './workflow-history.entity'

export interface CreateWorkflowHistoryDto {
  workflowInstanceId: string
  fromState?: string
  toState: string
  triggeredById?: string
  guardResult?: {
    passed: boolean
    expression?: string
    error?: string
  }
  actionResult?: {
    executed: boolean
    action?: string
    error?: string
  }
  metadata?: Record<string, any>
}

@Injectable()
export class WorkflowHistoryService {
  constructor(
    @InjectRepository(WorkflowHistory)
    private workflowHistoryRepository: Repository<WorkflowHistory>,
  ) {}

  async create(dto: CreateWorkflowHistoryDto): Promise<WorkflowHistory> {
    const history = this.workflowHistoryRepository.create({
      ...dto,
      timestamp: new Date(),
    })

    return this.workflowHistoryRepository.save(history)
  }

  async findByInstance(workflowInstanceId: string): Promise<WorkflowHistory[]> {
    return this.workflowHistoryRepository.find({
      where: { workflowInstanceId },
      relations: ['triggeredBy'],
      order: { timestamp: 'ASC' },
    })
  }

  async findOne(id: string): Promise<WorkflowHistory | null> {
    return this.workflowHistoryRepository.findOne({
      where: { id },
      relations: ['triggeredBy', 'workflowInstance'],
    })
  }
}
