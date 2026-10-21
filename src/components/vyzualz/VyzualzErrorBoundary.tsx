import { Component, type ErrorInfo, type ReactNode } from 'react'
import { productionOutputController } from './react/output/ProductionOutput'
import { createLogger } from '../../lib/logger'
import { isChunkLoadError } from '../../lib/chunkLoadError'

const log = createLogger('react', 'VyzualzErrorBoundary')

interface Props {
  /**
   * Label shown in the error card, e.g. "Canvas" or "Timeline".
   * Defaults to "VYZUALZ".
   */
  section?: string
  /** Reloads the app after a module failed to download. Defaults to reloading the window; injectable for tests. */
  onReload?: () => void
  children: ReactNode
}

interface State {
  error: Error | null
}

export class VyzualzErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    productionOutputController.handleRendererCrash(this.props.section)
    log.error(`${this.props.section ?? 'VyzualzView'} crashed: ${error.message}`, {
      section: this.props.section ?? 'VyzualzView',
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  handleReload = (): void => {
    if (this.props.onReload) this.props.onReload()
    else window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) {
      // A lazy module that failed to download stays failed (React.lazy keeps the rejection), so "Try again" would only re-throw it.
      if (isChunkLoadError(error)) {
        return (
          <div className="vz-error-boundary" role="alert">
            <span className="vz-error-boundary__label">
              {this.props.section ?? 'VYZUALZ'} could not load
            </span>
            <pre className="vz-error-boundary__message">
              Part of the app failed to download, so it can’t be shown yet. Reloading fetches it again.
            </pre>
            <button
              className="vz-error-boundary__reset"
              onClick={this.handleReload}
              type="button"
            >
              Reload
            </button>
          </div>
        )
      }
      return (
        <div className="vz-error-boundary" role="alert">
          <span className="vz-error-boundary__label">
            {this.props.section ?? 'VYZUALZ'} crashed
          </span>
          <pre className="vz-error-boundary__message">
            {error.message}
          </pre>
          <button
            className="vz-error-boundary__reset"
            onClick={this.handleReset}
            type="button"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
