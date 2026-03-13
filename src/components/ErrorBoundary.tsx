import React from 'react'

type Props = {
  children: React.ReactNode
  title?: string
  localStorageKeysToClear?: string[]
}

type State = {
  error: any
  errorInfo: any
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: any) {
    return { error, errorInfo: null }
  }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ error, errorInfo })
    try {
      console.error(error, errorInfo)
    } catch {}
  }

  clearAndReload = () => {
    try {
      const keys = this.props.localStorageKeysToClear || []
      for (const k of keys) {
        try {
          localStorage.removeItem(k)
        } catch {}
      }
    } finally {
      window.location.reload()
    }
  }

  reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const title = this.props.title || 'Something went wrong'
    const msg = String(this.state.error?.message || this.state.error || 'Unknown error')
    const stack = String(this.state.error?.stack || '')
    const componentStack = String(this.state.errorInfo?.componentStack || '')

    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-lg font-semibold text-rose-800">{title}</div>
          <div className="mt-2 text-sm text-rose-900">{msg}</div>

          {(stack || componentStack) && (
            <pre className="mt-3 max-h-[50vh] overflow-auto rounded-lg border border-rose-200 bg-white p-3 text-xs text-slate-800">
              {stack}
              {componentStack ? `\n\n${componentStack}` : ''}
            </pre>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button onClick={this.reload} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              Reload
            </button>
            <button onClick={this.clearAndReload} className="rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800">
              Clear saved settings & Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
