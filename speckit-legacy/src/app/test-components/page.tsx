'use client'

import React, { useState } from 'react'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { buildPageModel } from '@/components/runtime/schema-adapters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Slider } from '@/components/ui/slider'
import { Combobox } from '@/components/ui/combobox'
import { Calendar } from '@/components/ui/calendar'
import { DatePicker } from '@/components/ui/date-picker'
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu'

export default function TestComponentsPage() {
  const [switchValue, setSwitchValue] = useState(false)
  const [radioValue, setRadioValue] = useState('option1')
  const [selectedCombo, setSelectedCombo] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [sliderValue, setSliderValue] = useState([50])

  const comboboxOptions = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'orange', label: 'Orange' },
    { value: 'grape', label: 'Grape' },
  ]

  const pageModel = buildPageModel({
    id: 'test-components',
    path: '/test-components',
    fallbackTitle: 'Components Showcase',
    fallbackDescription: 'UI components preview',
  })

  return (
    <PageRuntime model={pageModel}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Speckit UI Components Showcase</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Complete collection of shadcn/ui components implemented for Speckit ERP
        </p>

        {/* Phase 1: High Priority Components */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Phase 1: High Priority Components</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Switch Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Switch</CardTitle>
                  <CardDescription>Toggle component for boolean values</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch checked={switchValue} onCheckedChange={setSwitchValue} />
                    <Label>Enable notifications</Label>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Current state: {switchValue ? 'ON' : 'OFF'}
                  </p>
                </CardContent>
              </Card>

              {/* Radio Group Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Radio Group</CardTitle>
                  <CardDescription>Single selection from multiple options</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option1" id="option1" />
                      <Label htmlFor="option1">Option 1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option2" id="option2" />
                      <Label htmlFor="option2">Option 2</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option3" id="option3" />
                      <Label htmlFor="option3">Option 3</Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Alert Dialog Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Alert Dialog</CardTitle>
                  <CardDescription>Confirmation dialog for important actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Delete Item</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the item.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Delete</AlertDialogAction>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>

              {/* Popover Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Popover</CardTitle>
                  <CardDescription>Floating content panel</CardDescription>
                </CardHeader>
                <CardContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">Open Popover</Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <div className="space-y-2">
                        <h4 className="font-medium">Popover Content</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          This is a popover with additional information.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>

              {/* Pagination Component */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Pagination</CardTitle>
                  <CardDescription>Navigate through pages of data</CardDescription>
                </CardHeader>
                <CardContent>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#" isActive>1</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">2</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">3</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext href="#" />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Phase 2: Medium Priority Components */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Phase 2: Medium Priority Components</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Accordion Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Accordion</CardTitle>
                  <CardDescription>Collapsible content panels</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Is it accessible?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It adheres to the WAI-ARIA design pattern.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Is it styled?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It comes with default styles that you can customize.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* Breadcrumb Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Breadcrumb</CardTitle>
                  <CardDescription>Navigation hierarchy indicator</CardDescription>
                </CardHeader>
                <CardContent>
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#">Home</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#">Components</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </CardContent>
              </Card>

              {/* Slider Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Slider</CardTitle>
                  <CardDescription>Range input control</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Slider value={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Value: {sliderValue[0]}
                  </p>
                </CardContent>
              </Card>

              {/* Combobox Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Combobox</CardTitle>
                  <CardDescription>Searchable select dropdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <Combobox
                    options={comboboxOptions}
                    value={selectedCombo}
                    onValueChange={setSelectedCombo}
                    placeholder="Select a fruit..."
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Phase 3: Low Priority Components */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Phase 3: Low Priority Components</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calendar Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Calendar</CardTitle>
                  <CardDescription>Date selection calendar</CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                </CardContent>
              </Card>

              {/* Date Picker Component */}
              <Card>
                <CardHeader>
                  <CardTitle>Date Picker</CardTitle>
                  <CardDescription>Popover date selection</CardDescription>
                </CardHeader>
                <CardContent>
                  <DatePicker value={selectedDate} onValueChange={setSelectedDate} />
                </CardContent>
              </Card>

              {/* Navigation Menu Component */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Navigation Menu</CardTitle>
                  <CardDescription>Complex navigation with submenus</CardDescription>
                </CardHeader>
                <CardContent>
                  <NavigationMenu>
                    <NavigationMenuList>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="w-[400px] p-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Learn how to get started with Speckit components.
                            </p>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger>Components</NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="w-[400px] p-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Browse all available components.
                            </p>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Summary */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle>Implementation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>✅ <strong>13 new components implemented</strong></p>
              <p>✅ All components follow shadcn/ui design patterns</p>
              <p>✅ Full TypeScript support with proper type definitions</p>
              <p>✅ Dark mode support included</p>
              <p>✅ Accessibility features built-in (ARIA labels, keyboard navigation)</p>
              <p>✅ Responsive design for mobile and desktop</p>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </PageRuntime>
  )
}
