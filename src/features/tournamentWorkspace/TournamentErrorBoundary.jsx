import React from "react";

export default class TournamentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro ao abrir torneio", error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.tournamentId !== this.props.tournamentId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="playAppShell">
          <main className="playMain">
            <section className="card">
              <h1>Não foi possível abrir este torneio</h1>
              <p>Os dados salvos dessa edição precisam ser revisados. Sua conta e os outros torneios continuam preservados.</p>
              <div className="actions">
                <button type="button" onClick={this.props.onBack}>Voltar aos torneios</button>
              </div>
            </section>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
