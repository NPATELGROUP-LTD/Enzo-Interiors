import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { reportError } from '@/lib/report';

import { Button } from './index';

interface Props {
  children: ReactNode;
  /** Full-screen (the whole app broke) rather than inside the window. */
  screen?: boolean;
}

/**
 * A render error in one screen shows this instead of a blank page, with a way
 * out. Class component: React has no hook for it.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
    reportError(error.message, /at (\w+)/.exec(info.componentStack ?? '')?.[1]);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className={`flex items-center justify-center px-6 py-16 ${this.props.screen ? 'wallpaper min-h-dvh' : 'min-h-full'}`}
      >
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink">This page hit a problem</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Nothing you entered elsewhere was lost. Try again, and if it keeps happening, reload the page.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => this.setState({ failed: false })}>
              Try again
            </Button>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/** Keyed by address, so moving to another page recovers from a broken one. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary key={useLocation().pathname}>{children}</ErrorBoundary>;
}
