import { BlueprintAppRuntime } from '@sap/ui-runtime/blueprint/BlueprintAppRuntime'

export default async function BlueprintAppPage({
  params,
}: {
  params: Promise<{ packageId: string; page?: string[] }>
}) {
  const resolved = await params
  return (
    <BlueprintAppRuntime
      packageId={resolved.packageId}
      pageId={resolved.page?.[0]}
    />
  )
}
