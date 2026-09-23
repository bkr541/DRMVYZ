import { Component, type ErrorInfo, type ReactNode } from 'react'
import { productionOutputController } from './react/output/ProductionOutput'
import { createLogger } from '../../lib/logger'

const log = createLogger('react', 'VyzualzErrorBoundary')

interface Props {
  /**
   * Label shown in the error card, e.g. "Canvas" or "Timeline".
   * Defaults to "VYZUALZ".
   */
  section?: string
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

  render(): ReactNode {
    const { error } = this.state
    if (error) {
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
