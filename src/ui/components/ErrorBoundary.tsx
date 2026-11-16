// Crash recovery: if a screen throws, show a calm recovery screen with a one-tap backup instead of a blank page.
import { Component, type ReactNode } from "react";
import { REST } from "../../core/figure/poses";
import { IdbAdapter } from "../../storage/idbAdapter";
import { downloadBackup } from "../backup";
import { Figure } from "./Figure";
import { Icon } from "./Icon";

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; saved: string | null }> {
  state = { error: null as Error | null, saved: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error, saved: null }; }
  componentDidCatch(error: Error) { console.error("Screen crashed:", error); }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }

  private backup = async () => {
    try {
      // Read straight from storage, so it works even if the app's state is what broke.
      const db = new IdbAdapter();
      await db.init(() => { throw new Error("No data to back up yet."); });
      await downloadBackup(await db.exportAll());
      this.setState({ saved: "Backup downloaded." });
    } catch (e) {
      this.setState({ saved: "Couldn't create the backup: " + (e as Error).message });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="empty" style={{ paddingTop: 50, color: "var(--ink)" }}>
          <div className="fig-stage"><Figure spec={REST} size={140} /></div>
          <h1 className="title-lg">Something went wrong</h1>
          <p className="muted" style={{ maxWidth: 320 }}>This screen hit an error. Your workouts are stored safely on this phone. Save a backup to be sure, then go back.</p>
          <div className="stack" style={{ width: "100%", maxWidth: 320, marginTop: 8 }}>
            <button className="btn btn-primary btn-block" style={{ minHeight: 54 }} onClick={this.backup}><Icon name="download" size={18} /> Save a backup</button>
            {this.state.saved && <p style={{ fontSize: 13 }}>{this.state.saved}</p>}
            <button className="btn btn-ghost btn-block" onClick={() => { location.hash = "#/today"; this.setState({ error: null }); }}>Go to Today</button>
            <button className="btn btn-quiet btn-block" onClick={() => location.reload()}>Reload the app</button>
          </div>
          <code className="mono muted" style={{ fontSize: 11, marginTop: 12, wordBreak: "break-word", maxWidth: 320 }}>{this.state.error.message}</code>
        </div>
      </div>
    );
  }
}
