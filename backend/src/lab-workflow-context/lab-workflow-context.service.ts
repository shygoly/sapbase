import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  LabWorkflowExecution,
  LabWorkflowExecutionStatus,
} from './lab-workflow-execution.entity'
import { CreateLabWorkflowExecutionDto } from './dto/create-lab-workflow-execution.dto'
import { UpdateLabWorkflowStepDto } from './dto/update-lab-workflow-step.dto'

@Injectable()
export class LabWorkflowContextService {
  constructor(
    @InjectRepository(LabWorkflowExecution)
    private readonly executionRepository: Repository<LabWorkflowExecution>,
  ) {}

  async create(dto: CreateLabWorkflowExecutionDto, organizationId: string): Promise<LabWorkflowExecution> {
    const execution = this.executionRepository.create({
      ...dto,
      assignedAnalystId: dto.assignedAnalystId ?? null,
      plannedSteps: dto.plannedSteps ?? 1,
      currentStep: 1,
      status: LabWorkflowExecutionStatus.PENDING,
      organizationId,
      startedAt: null,
      completedAt: null,
      context: null,
    })

    return this.executionRepository.save(execution)
  }

  async findOne(id: string, organizationId: string): Promise<LabWorkflowExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id, organizationId },
    })

    if (!execution) {
      throw new NotFoundException('Workflow execution not found')
    }

    return execution
  }

  async getAnalystWorkQueue(organizationId: string, analystId: string): Promise<LabWorkflowExecution[]> {
    return this.executionRepository.find({
      where: {
        organizationId,
        assignedAnalystId: analystId,
      },
      order: { createdAt: 'DESC' },
    })
  }

  async completeStep(
    executionId: string,
    dto: UpdateLabWorkflowStepDto,
    organizationId: string,
  ): Promise<LabWorkflowExecution> {
    const execution = await this.findOne(executionId, organizationId)

    if (execution.status === LabWorkflowExecutionStatus.PENDING) {
      execution.status = LabWorkflowExecutionStatus.IN_PROGRESS
      execution.startedAt = execution.startedAt ?? new Date()
    }

    const nextStep = dto.nextStep ?? execution.currentStep + 1
    execution.currentStep = nextStep

    execution.context = {
      ...(execution.context ?? {}),
      lastStepNotes: dto.stepNotes,
      lastUpdatedAt: new Date().toISOString(),
    }

    if (execution.currentStep >= execution.plannedSteps) {
      execution.status = LabWorkflowExecutionStatus.COMPLETED
      execution.completedAt = new Date()
    }

    return this.executionRepository.save(execution)
  }
}
