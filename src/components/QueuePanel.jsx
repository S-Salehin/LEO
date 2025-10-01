import React, { useMemo } from "react";
import { useApp } from "../store/appState";
import { summarizeRisk } from "../utils/scoring";

export default function QueuePanel({ kp }) {
  const { state, actions } = useApp();
  const summary = useMemo(() => summarizeRisk(state.queue, { kp, dragScale: state.drag }), [state.queue, kp, state.drag]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state.queue, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "queue.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const text = await file.text();
      try {
        const arr = JSON.parse(text);
        actions.loadQueue(arr);
      } catch {}
    };
    input.click();
  };

  const copyShare = async () => {
    const hash = btoa(unescape(encodeURIComponent(JSON.stringify(state.queue))));
    const url = `${location.origin}${location.pathname}#q=${hash}`;
    await navigator.clipboard.writeText(url);
    alert("Share link copied.");
  };

  return (
    <div className="card">
      <div className="card-title">Debris capture queue</div>
      <div style={{ fontSize: 13, color: "#a3b4c4", marginBottom: 8 }}>
        Queued targets: <b>{state.queue.length}</b> &nbsp;|&nbsp; Risk removed (est): <b>{summary.pct}</b>
      </div>

      <div className="btn-row">
        <button className="btn" disabled={!state.queue.length} onClick={() => actions.clearQueue()}>Clear</button>
        <button className="btn" disabled={!state.queue.length} onClick={exportJSON}>Export JSON</button>
        <button className="btn" onClick={importJSON}>Import JSON</button>
        <button className="btn" disabled={!state.queue.length} onClick={copyShare}>Copy share link</button>
      </div>

      <div className="list">
        {state.queue.map((q) => (
          <div key={q.id} className="list-row">
            <div>
              <div className="list-title">{q.name}</div>
              <div className="list-sub">
                {q.kind === "debris" ? "Debris" : "Satellite"} · alt {q.alt_km ?? "—"} km · i {q.inc_deg ?? "—"}° · Ω {q.raan_deg ?? "—"}°
              </div>
            </div>
            <button className="btn tiny" onClick={() => actions.removeFromQueue(q.id)}>Remove</button>
          </div>
        ))}
        {!state.queue.length && <div className="list-empty">Nothing queued yet.</div>}
      </div>
    </div>
  );
}
