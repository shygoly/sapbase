'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { PageRuntime } from '@/components/runtime/page-runtime'
import { FormRuntime } from '@/components/runtime/form-runtime'
import { buildPageModel } from '@/components/runtime/schema-adapters'
import { useAuth } from '@/core/auth/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
  rememberMe: z.boolean().default(false),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'user1@example.com',
      password: 'password123',
      rememberMe: false,
    },
  })

  const pageModel = buildPageModel({
    id: 'login',
    path: '/login',
    fallbackTitle: 'Login',
    fallbackDescription: 'Authentication',
  })

  const formSchema = {
    id: 'login-form',
    title: 'Login',
    fields: [
      { name: 'email', type: 'email', label: 'Email', required: true },
      { name: 'password', type: 'password', label: 'Password', required: true },
      { name: 'rememberMe', type: 'checkbox', label: 'Remember me' },
    ],
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      await login(data.email, data.password)

      setSuccess(true)

      // Redirect:
      // - allow overriding via ?redirect=/path or ?next=/path
      // - default to a reasonable "dashboard" page
      let raw = ''
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search)
        raw = sp.get('redirect') || sp.get('next') || ''
      }
      const redirectTo =
        raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin/users'

      setTimeout(() => {
        router.replace(redirectTo)
      }, 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查邮箱和密码')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageRuntime model={pageModel}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 mb-4">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Speckit ERP</h1>
          <p className="text-slate-400">企业资源规划系统</p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader className="space-y-2">
            <CardTitle className="text-white">登录</CardTitle>
            <CardDescription>输入您的凭证以访问系统</CardDescription>
          </CardHeader>

          <CardContent>
            <FormRuntime schema={formSchema}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              {/* Success Alert */}
              {success && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <p className="text-sm text-green-500">登录成功，正在跳转...</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">
                  邮箱地址
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user1@example.com"
                  disabled={isLoading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus-visible:ring-blue-500"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-200">
                    密码
                  </Label>
                  <a
                    href="#"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    忘记密码？
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus-visible:ring-blue-500"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  disabled={isLoading}
                  className="border-slate-500"
                  {...register('rememberMe')}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm text-slate-300 cursor-pointer font-normal"
                >
                  记住我
                </Label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>

              {/* Demo Credentials */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-1 font-semibold">演示凭证：</p>
                <p className="text-xs text-blue-300">邮箱: user1@example.com</p>
                <p className="text-xs text-blue-300">密码: password123</p>
              </div>
              </form>
            </FormRuntime>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-400">
          <p>© 2026 Speckit ERP. 保留所有权利。</p>
        </div>
        </div>
      </div>
    </PageRuntime>
  )
}
