'use client'

import React from 'react'

interface RuntimeErrorBoundaryState {
  error: Error | null
}

/**
 * 布局级错误边界：页面渲染错误只影响当前区域，不白屏整个 shell。
 * 不吞掉错误：开发环境展示 message，生产环境展示通用提示 + 重试。
 */
export class RuntimeErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: (error: Error, retry: () => void) => React.ReactNode },
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // 交给浏览器/监控；这里保证不静默。
    console.error('[RuntimeErrorBoundary]', error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.state.error, this.retry)
    return (
      <div className='m-4 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900'>
        <div className='font-medium'>页面渲染失败</div>
        <p className='mt-1 text-red-700'>
          {process.env.NODE_ENV === 'development'
            ? this.state.error.message
            : '请重试或联系管理员。'}
        </p>
        <button
          type='button'
          onClick={this.retry}
          className='mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-red-800'
        >
          重试
        </button>
      </div>
    )
  }
}
