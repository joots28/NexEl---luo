import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("NexEl render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="nexel-error-fallback" role="alert">
          <div className="nexel-error-mark">N<span>.</span></div>
          <p className="eyebrow">NEXEL / RECUPERAÇÃO</p>
          <h1>Esta tela encontrou um problema.</h1>
          <p>Não foi possível carregar esta parte do site. Recarregue a página para tentar novamente.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
