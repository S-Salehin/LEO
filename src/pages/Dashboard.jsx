import React, { useEffect, useMemo, useState } from "react";
import Globe3D from "../components/Globe3D";
import QueuePanel from "../components/QueuePanel";
import MiniMap2D from "../components/MiniMap2D";
import { useApp } from "../store/appState";

/* NASA DONKI Kp fetch (last 24h) */
async function fetchKp() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url = `https://api.nasa.gov/DONKI/KP?startDate=${fmt(start)}&endDate=${fmt(end)}&api_key=DEMO_KEY`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("DONKI Kp failed");
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  const last = arr[arr.length - 1];
  return Number(last.kpIndex) || null;
}

function clampDateStr(s) {
  return (s ? s : new Date().toISOString().slice(0, 10)).slice(0, 10);
}

export default function Dashboard() {
  const { state, actions } = useApp();

  // Load queue from share link (if present)
  useEffect(() => {
    const hash = new URL(location.href).hash;
    const m = hash.match(/#q=([^&]+)/);
    if (m && m[1]) {
      try {
        const json = decodeURIComponent(escape(atob(m[1])));
        const arr = JSON.parse(json);
        actions.loadQueue(arr);
      } catch {
        /* ignore */
      }
    }
  }, [actions]);

  // Live Kp from DONKI
  const [kp, setKp] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchKp().then(v => !cancelled && setKp(v)).catch(() => setKp(null));
    const id = setInterval(
      () => fetchKp().then(v => !cancelled && setKp(v)).catch(() => {}),
      15 * 60 * 1000
    );
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dateLabel = useMemo(
    () => clampDateStr(state.overlayDate || new Date().toISOString().slice(0, 10)),
    [state.overlayDate]
  );

  // Date controls
  const setDate = (s) => actions.setOverlayDate(clampDateStr(s));
  const stepDate = (days) => {
    const d = new Date(dateLabel);
    d.setUTCDate(d.getUTCDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  // Queue add from current selection
  const addSelected = () => {
    if (!state.selection) return;
    actions.addToQueue({ ...state.selection, kind: state.selection.kind || "sat" });
  };

  // 2D Worldview snapshot modal
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="container">
      {/* Only brand + chips here.
          The top-right route tabs come from App.jsx (main-nav). */}
      <div className="topbar">
        <div className="brand">
          NASA <span>AstroLEO</span>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 400, 
            color: "var(--muted)", 
            marginTop: 2,
            letterSpacing: 0.5
          }}>
            Mission Control Dashboard
          </div>
        </div>

        <div className="chips">
          <div className="chip">
            <div className="date-chip">
              <span>📅 Worldview</span>
              <button className="bttn" aria-label="previous day" onClick={() => stepDate(-1)}>–</button>
              <input type="date" value={dateLabel} onChange={(e) => setDate(e.target.value)} />
              <button className="bttn" aria-label="next day" onClick={() => stepDate(1)}>+</button>
            </div>
          </div>
          <div className="chip" style={{ background: kp && kp > 5 ? "var(--danger-glow)" : undefined }}>
            ☀️ DONKI Kp · <b style={{ color: kp && kp > 5 ? "var(--danger)" : "var(--brand)" }}>{kp ?? "—"}</b>
          </div>
          <div className="chip">
            🌪️ Drag · <b style={{ color: state.drag > 1.3 ? "var(--warning)" : "var(--success)" }}>{state.drag.toFixed(2)}×</b>
          </div>
          <div className="chip" style={{ background: "var(--accent-glow)", borderColor: "var(--brand)" }}>
            🛰️ Queue · <b style={{ color: "var(--brand)" }}>{state.queue.length}</b>
          </div>
        </div>
      </div>

      <div className="grid">
        {/* Left column */}
        <div className="col-left">
          <div className="card">
            <div className="card-title">🎯 Mission Overview</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: 12,
              background: "rgba(0, 212, 255, 0.05)",
              borderRadius: 10,
              marginBottom: 12
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Δv Budget</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>1,800 m/s</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Targets Queued</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand)" }}>{state.queue.length}</div>
              </div>
            </div>
            <div className="kv">
              <span>Space Weather:</span>
              <b style={{ color: kp && kp > 5 ? "var(--danger)" : "var(--success)" }}>
                Kp {kp ?? "—"} → Drag {state.drag.toFixed(2)}×
              </b>
            </div>
            <div className="hint" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              💡 Higher Kp index indicates increased solar activity and atmospheric drag, 
              affecting orbital decay rates and mission planning.
            </div>
          </div>

          <div className="card">
            <div className="card-title">⚙️ Simulation Controls</div>
            <div className="kv">
              <span>⏱️ Speed</span>
              <input
                type="range"
                min="0.2"
                max="5"
                step="0.1"
                value={state.simSpeed}
                onChange={(e) => actions.setSimSpeed(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <b style={{ color: "var(--brand)", minWidth: 45 }}>{state.simSpeed.toFixed(1)}×</b>
            </div>
            <div className="kv">
              <span>🌪️ Drag (Kp)</span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={state.drag}
                onChange={(e) => actions.setDrag(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <b style={{ 
                color: state.drag > 1.3 ? "var(--warning)" : "var(--success)",
                minWidth: 45
              }}>
                {state.drag.toFixed(2)}×
              </b>
            </div>
            <div className="hint">
              Adjust simulation speed and atmospheric drag multiplier to observe 
              orbital decay effects under different space weather conditions.
            </div>
          </div>

          <div className="card">
            <div className="card-title">🌍 Earth Overlay (NASA GIBS)</div>
            <div className="btn-row">
              <button
                className={`btn ${state.overlayType === "atmoRivers" ? "primary" : ""}`}
                onClick={() => actions.setOverlay("atmoRivers")}
              >
                🌊 Atmospheric Rivers
              </button>
              <button
                className={`btn ${state.overlayType === "elNino" ? "primary" : ""}`}
                onClick={() => actions.setOverlay("elNino")}
              >
                🌡️ El Niño Impact
              </button>
              <button className="btn" onClick={() => actions.setOverlay("none")}>
                ✖ Clear
              </button>
              <button 
                className="btn" 
                onClick={() => setMapOpen(true)}
                style={{ background: "var(--accent-glow)", borderColor: "var(--brand)" }}
              >
                🗺️ Open 2D Map
              </button>
            </div>
            <div className="hint">
              Real-time NASA GIBS satellite imagery showing environmental data. 
              Network unavailable? Falls back to Blue Marble static imagery.
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="card">
            <div className="card-title">⚠️ Risk Analysis</div>
            <div style={{
              background: "rgba(255, 71, 87, 0.1)",
              border: "1px solid var(--danger)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                Critical Risk Objects
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>
                {state.queue.length > 0 ? state.queue.length : "—"}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                Objects in capture queue
              </div>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Collision Probability</span>
                <b style={{ color: "var(--warning)" }}>
                  {state.queue.length > 3 ? "High" : state.queue.length > 0 ? "Medium" : "Low"}
                </b>
              </div>
              <div style={{ 
                height: 8, 
                background: "var(--line)", 
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, state.queue.length * 15)}%`,
                  background: state.queue.length > 3 ? "var(--danger)" : state.queue.length > 0 ? "var(--warning)" : "var(--success)",
                  borderRadius: 4,
                  transition: "all 0.3s ease"
                }} />
              </div>
            </div>

            <div className="hint">
              💡 Risk increases with atmospheric drag (Kp index) and orbital density. 
              Add high-risk objects to the capture queue for removal planning.
            </div>
          </div>

          <QueuePanel kp={kp ?? 3} />
        </div>

        {/* Right column */}
        <div className="col-right">
          <div className="card card-3d">
            <div className="canvas-wrap">
              <Globe3D
                overlayType={state.overlayType}
                overlayDate={dateLabel}
                onSelect={(info) => actions.setSelection(info)}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title">🎯 Selected Object</div>
            {!state.selection && (
              <div style={{ 
                color: "var(--muted)", 
                textAlign: "center", 
                padding: "24px 12px",
                background: "rgba(0, 212, 255, 0.03)",
                borderRadius: 10,
                border: "1px dashed var(--line)"
              }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>🛰️</div>
                <div>Hover over a satellite or debris in the 3D view to select</div>
              </div>
            )}
            {state.selection && (
              <div className="sel">
                <div style={{ 
                  background: "rgba(0, 212, 255, 0.08)", 
                  padding: 12, 
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  marginBottom: 12
                }}>
                  <div className="sel-title" style={{ 
                    fontSize: 16, 
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}>
                    {state.selection.kind === "debris" ? "💥" : "🛰️"} {state.selection.name}
                  </div>
                  <div style={{ 
                    fontSize: 11, 
                    color: "var(--muted)",
                    background: state.selection.kind === "debris" ? "var(--danger-glow)" : "var(--accent-glow)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    display: "inline-block",
                    fontWeight: 600,
                    textTransform: "uppercase"
                  }}>
                    {state.selection.kind === "debris" ? "⚠️ Debris" : "✓ Active Satellite"}
                  </div>
                </div>
                
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                  Orbital Parameters
                </div>
                <div className="sel-rows" style={{ marginBottom: 16 }}>
                  <div style={{ 
                    background: "rgba(0, 212, 255, 0.05)", 
                    padding: 8, 
                    borderRadius: 8,
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Altitude</div>
                    <b style={{ color: "var(--brand)" }}>{state.selection.alt_km ?? "—"}</b>
                    <div style={{ fontSize: 9, color: "var(--muted)" }}>km</div>
                  </div>
                  <div style={{ 
                    background: "rgba(0, 212, 255, 0.05)", 
                    padding: 8, 
                    borderRadius: 8,
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Inclination</div>
                    <b style={{ color: "var(--brand)" }}>{state.selection.inc_deg ?? "—"}</b>
                    <div style={{ fontSize: 9, color: "var(--muted)" }}>°</div>
                  </div>
                  <div style={{ 
                    background: "rgba(0, 212, 255, 0.05)", 
                    padding: 8, 
                    borderRadius: 8,
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>RAAN (Ω)</div>
                    <b style={{ color: "var(--brand)" }}>{state.selection.raan_deg ?? "—"}</b>
                    <div style={{ fontSize: 9, color: "var(--muted)" }}>°</div>
                  </div>
                  <div style={{ 
                    background: "rgba(0, 212, 255, 0.05)", 
                    padding: 8, 
                    borderRadius: 8,
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Latitude (φ)</div>
                    <b style={{ color: "var(--brand)" }}>{state.selection.lat_deg ?? "—"}</b>
                    <div style={{ fontSize: 9, color: "var(--muted)" }}>°</div>
                  </div>
                  <div style={{ 
                    background: "rgba(0, 212, 255, 0.05)", 
                    padding: 8, 
                    borderRadius: 8,
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Longitude (λ)</div>
                    <b style={{ color: "var(--brand)" }}>{state.selection.lon_deg ?? "—"}</b>
                    <div style={{ fontSize: 9, color: "var(--muted)" }}>°</div>
                  </div>
                </div>
                
                {/* Health & Battery for Satellites */}
                {state.selection.kind === "sat" && state.selection.health !== undefined && (
                  <>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                      Satellite Status
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div style={{
                        background: state.selection.health > 80 ? "rgba(0, 255, 159, 0.1)" : 
                                   state.selection.health > 50 ? "rgba(255, 214, 0, 0.1)" : "rgba(255, 71, 87, 0.1)",
                        border: `1px solid ${state.selection.health > 80 ? "var(--success)" : 
                                             state.selection.health > 50 ? "var(--warning)" : "var(--danger)"}`,
                        padding: 12,
                        borderRadius: 8
                      }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                          {state.selection.health > 80 ? "✓" : state.selection.health > 50 ? "⚠" : "✗"} Health Status
                        </div>
                        <div style={{ 
                          fontSize: 24, 
                          fontWeight: 700,
                          color: state.selection.health > 80 ? "var(--success)" : 
                                 state.selection.health > 50 ? "var(--warning)" : "var(--danger)"
                        }}>
                          {state.selection.health}%
                        </div>
                      </div>
                      <div style={{
                        background: state.selection.battery > 70 ? "rgba(0, 255, 159, 0.1)" : 
                                   state.selection.battery > 30 ? "rgba(255, 214, 0, 0.1)" : "rgba(255, 71, 87, 0.1)",
                        border: `1px solid ${state.selection.battery > 70 ? "var(--success)" : 
                                             state.selection.battery > 30 ? "var(--warning)" : "var(--danger)"}`,
                        padding: 12,
                        borderRadius: 8
                      }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                          {state.selection.battery > 70 ? "🔋" : state.selection.battery > 30 ? "🪫" : "⚠️"} Battery Level
                        </div>
                        <div style={{ 
                          fontSize: 24, 
                          fontWeight: 700,
                          color: state.selection.battery > 70 ? "var(--success)" : 
                                 state.selection.battery > 30 ? "var(--warning)" : "var(--danger)"
                        }}>
                          {state.selection.battery}%
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <div className="btn-row">
                  <button className="btn primary" onClick={addSelected} style={{ flex: 1 }}>
                    ➕ Add to Capture Queue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Worldview 2D snapshot modal */}
      <MiniMap2D
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        dateStr={dateLabel}
        overlayType={state.overlayType}
      />
    </div>
  );
}
