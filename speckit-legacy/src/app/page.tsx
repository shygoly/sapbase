import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { buildPageModel } from '@/components/runtime/schema-adapters'

export default function Home() {
  const pageModel = buildPageModel({
    id: 'home',
    path: '/',
    fallbackTitle: 'Speckit ERP Frontend Runtime',
    fallbackDescription: 'Business-Agnostic Enterprise ERP Frontend Runtime',
  })

  return (
    <PageRuntime model={pageModel}>
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-4xl">Speckit v1.0 ERP Frontend Runtime</CardTitle>
            <CardDescription className="text-xl">
              Business-Agnostic Enterprise ERP Frontend Runtime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Phase 1: Basic Runtime Skeleton</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/docs">Documentation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </PageRuntime>
  )
}
