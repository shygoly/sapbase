'use client'

import React, { useState, useEffect } from 'react'
import { aiModulesApi, type AIModule, type AIModuleTest } from '@/lib/api/ai-modules.api'
import { moduleRegistryApi, type ModuleRegistry } from '@/lib/api/module-registry.api'
import { useNotification } from '@/core/ui/ui-hooks'
import { PermissionGuard } from '@/core/auth/permission-guard'
import { Button } from '@/components/ui/button'
import PageContainer from '@/components/layout/page-container'
import { TestTube, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ModuleOption {
  id: string
  name: string
  status: string
  aiModuleId?: string
  registryId?: string
  testResults?: AIModule['testResults']
}

export default function AIModuleTestPage() {
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<string>('')
  const [selectedModule, setSelectedModule] = useState<ModuleOption | null>(null)
  const [tests, setTests] = useState<AIModuleTest[]>([])
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const notification = useNotification()

  useEffect(() => {
    fetchModules()
  }, [])

  useEffect(() => {
    if (selectedModuleId) {
      const module = modules.find((m) => m.id === selectedModuleId)
      setSelectedModule(module || null)
      if (module?.testResults?.tests) {
        // Convert test results to AIModuleTest format
        setTests(
          module.testResults.tests.map((t: any) => ({
            id: t.id,
            moduleId: module.id,
            testName: t.name,
            entityType: t.name.split(' ')[0],
            status: t.status,
            executedAt: undefined,
            duration: undefined,
          })),
        )
      } else {
        setTests([])
      }
    }
  }, [selectedModuleId, modules])

  const fetchModules = async () => {
    setIsLoading(true)
    try {
      // Fetch both AI modules and registry modules
      const [aiModules, registryModules] = await Promise.all([
        aiModulesApi.findAll().catch(() => []),
        moduleRegistryApi.findAll().catch(() => []),
      ])

      const moduleMap = new Map<string, ModuleOption>()

      // Add AI modules
      aiModules.forEach((module) => {
        moduleMap.set(module.id, {
          id: module.id,
          name: module.name,
          status: module.status,
          aiModuleId: module.id,
          testResults: module.testResults,
        })
      })

      // Add registry modules (including CRM)
      registryModules.forEach((registry) => {
        if (registry.aiModuleId && moduleMap.has(registry.aiModuleId)) {
          // Already added as AI module, skip
          return
        }
        // Use registry ID as the key, but store aiModuleId if available
        moduleMap.set(registry.id, {
          id: registry.aiModuleId || registry.id,
          name: registry.name,
          status: registry.status,
          aiModuleId: registry.aiModuleId,
          registryId: registry.id,
        })
      })

      setModules(Array.from(moduleMap.values()))
    } catch (error) {
      notification.error('Failed to load modules')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRunTests = async () => {
    if (!selectedModuleId) {
      notification.error('Please select a module')
      return
    }

    const module = modules.find((m) => m.id === selectedModuleId)
    if (!module) {
      notification.error('Module not found')
      return
    }

    // If module doesn't have aiModuleId, we need to create a temporary AIModule
    let testModuleId = module.aiModuleId
    if (!testModuleId && module.registryId) {
      // For registry-only modules (like CRM), create a temporary AIModule for testing
      try {
        const tempModule = await aiModulesApi.create({
          name: module.name,
          description: `Temporary module for testing ${module.name}`,
          status: 'draft',
        })
        testModuleId = tempModule.id
      } catch (error) {
        notification.error('Failed to create test module')
        return
      }
    }

    if (!testModuleId) {
      notification.error('Cannot run tests: module has no AI module ID')
      return
    }

    setIsRunningTests(true)
    try {
      const testResults = await aiModulesApi.runTests(testModuleId)
      setTests(testResults)
      await fetchModules()
      notification.success('Tests completed')
    } catch (error) {
      notification.error('Failed to run tests')
    } finally {
      setIsRunningTests(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Passed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        )
      case 'running':
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Running
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <PermissionGuard permissions={['system:manage']}>
      <PageContainer
        pageTitle="AI Module Testing"
        pageDescription="Test AI-generated modules using CRM test suite"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Module</CardTitle>
              <CardDescription>
                Choose a module to test against CRM entities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoading ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading modules...
                      </div>
                    ) : modules.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No modules available
                      </div>
                    ) : (
                      modules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.name} ({module.status})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRunTests}
                  disabled={!selectedModuleId || isRunningTests}
                >
                  {isRunningTests ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Run Tests
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {selectedModule && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>
                  {selectedModule.testResults
                    ? `${selectedModule.testResults.passed}/${selectedModule.testResults.total} tests passed`
                    : 'No tests run yet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No test results available. Run tests to see results.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Test Name</TableHead>
                          <TableHead>Entity Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tests.map((test) => (
                          <TableRow key={test.id}>
                            <TableCell className="font-medium">
                              {test.testName}
                            </TableCell>
                            <TableCell>{test.entityType}</TableCell>
                            <TableCell>{getStatusBadge(test.status)}</TableCell>
                            <TableCell>
                              {test.duration ? `${test.duration}ms` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </PageContainer>
    </PermissionGuard>
  )
}
