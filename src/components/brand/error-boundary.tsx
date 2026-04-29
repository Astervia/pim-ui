/**
 * Top-level ErrorBoundary. Without this, any thrown error during render
 * unmounts the React tree and the user sees a black window with no
 * indication of what went wrong. The boundary instead surfaces the error
 * message + component stack so issues are diagnosable in the wild.
 */

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null, componentStack: null });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error === null) return this.props.children;

    const message = this.state.error.message || String(this.state.error);
    const stack = this.state.error.stack ?? "";
    const componentStack = this.state.componentStack ?? "";

    return (
      <main
        role="alert"
        className="min-h-screen bg-background text-foreground p-6 font-mono text-sm overflow-auto"
      >
        <div className="max-w-3xl">
          <header className="flex items-center gap-3 text-destructive uppercase tracking-widest text-xs">
            <span aria-hidden="true">✗</span>
            <span className="font-semibold">UI CRASHED</span>
          </header>
          <p className="mt-4 text-foreground leading-[1.6]">{message}</p>
          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={this.reset}
              className="mr-3 underline underline-offset-4 hover:text-accent"
            >
              [ try again ]
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="underline underline-offset-4 hover:text-accent"
            >
              [ reload ]
            </button>
          </div>
          {stack.length > 0 ? (
            <details className="mt-6 text-muted-foreground">
              <summary className="cursor-pointer">stack</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{stack}</pre>
            </details>
          ) : null}
          {componentStack.length > 0 ? (
            <details className="mt-4 text-muted-foreground">
              <summary className="cursor-pointer">component stack</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">
                {componentStack}
              </pre>
            </details>
          ) : null}
        </div>
      </main>
    );
  }
}
