// src/pages/Policies.jsx
import React, { useMemo, useState } from "react";
import { predictCollisionRisk, kmeansOrbits, monteCarloYear } from "../ai/riskModel";
import { Sparkline, Bar, Donut } from "../components/SimpleCharts";

/** Parse TLE data to get realistic satellite objects */
async function fetchTLEData() {
  try {
    const response = await fetch('/tle/custom.tle');
    const text = await response.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    const objects = [];
    for (const ln of lines) {
      if (!ln || ln.startsWith("#")) continue;
      const [name, alt, inc, raan, mm, kind, health, battery] = ln.split(/\s*,\s*/);
      if (!name || !alt || !inc || !raan || !mm) continue;
      
      objects.push({
        id: name,
        name,
        altKm: parseFloat(alt),
        incDeg: parseFloat(inc),
        raanDeg: parseFloat(raan),
        type: (kind || "sat").toLowerCase(),
        density: kind === "debris" ? 0.42 : 0.25 + (Math.random() * 0.15),
        health: health ? parseFloat(health) : 100,
        battery: battery ? parseFloat(battery) : 100
      });
    }
    return objects;
  } catch (error) {
    console.error("Failed to load TLE data:", error);
    return [];
  }
}

function useOrbitObjects() {
  const [objects, setObjects] = React.useState([]);
  
  React.useEffect(() => {
    fetchTLEData().then(data => {
      if (data.length > 0) {
        setObjects(data);
      } else {
        // Fallback to demo data
        const demo = [
          ...Array.from({length: 20}).map((_,i)=>({
            id: `DEMO-${(i+1).toString().padStart(2,"0")}`,
            name: `DEMO-${(i+1).toString().padStart(2,"0")}`,
            altKm: 520 + (i%5)*40,
            incDeg: 53 + (i%4)*10,
            raanDeg: (i*37)%360,
            type: "sat",
            density: 0.25 + (i%5)*0.08
          })),
          ...Array.from({length: 6}).map((_,i)=>({
            id: `D-${i+1}`,
            name: `Debris-${i+1}`,
            altKm: 650 + (i%3)*30,
            incDeg: 97 + (i%3)*2,
            raanDeg: (i*71)%360,
            type: "debris",
            density: 0.42
          }))
        ];
        setObjects(demo);
      }
    });
  }, []);

  const live = window?.leo?.objects ?? window?.__leoObjects;
  return (Array.isArray(live) && live.length) ? live : objects;
}

export default function Policies() {
  const objects = useOrbitObjects();

  // policy knobs
  const [deorbitCompliance, setCompliance] = useState(0.6); // % of planned removals achieved
  const [cadencePerMonth, setCadence]    = useState(6);     // targets per month
  const [dragMult, setDrag]              = useState(1.0);   // space weather multiplier (from Kp)
  const [showKmeans, setShowKmeans]      = useState(false);

  // risk per object
  const withRisk = useMemo(()=>{
    return objects.map(o=>{
      const { p } = predictCollisionRisk({
        altKm:o.altKm, incDeg:o.incDeg, density:o.density ?? 0.25, dragMult, debris: o.type === "debris" ? 1:0
      });
      return { ...o, risk: p };
    }).sort((a,b)=>b.risk-a.risk);
  },[objects, dragMult]);

  // top recommendations to remove (mix: highest risk + debris first)
  const recommendations = useMemo(()=>{
    const onlyDebris = withRisk.filter(x=>x.type==="debris").slice(0, Math.ceil(cadencePerMonth*0.6));
    const remain = withRisk.filter(x=>x.type!=="debris").slice(0, Math.max(0, cadencePerMonth - onlyDebris.length));
    return [...onlyDebris, ...remain].slice(0, cadencePerMonth);
  },[withRisk, cadencePerMonth]);

  // k-means for viz
  const km = useMemo(()=> kmeansOrbits(withRisk, 4, 8), [withRisk]);

  // 12-month projection
  const projection = useMemo(()=>{
    return monteCarloYear(withRisk, { deorbitCompliance, cadencePerMonth, dragMult }, 12);
  },[withRisk, deorbitCompliance, cadencePerMonth, dragMult]);

  // KPI quick stats
  const avgRisk = withRisk.reduce((s,x)=>s+x.risk,0)/(withRisk.length||1);
  const debrisShare = withRisk.filter(x=>x.type==="debris").length/(withRisk.length||1);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          NASA <span>Policy Lab</span>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 400, 
            color: "var(--muted)", 
            marginTop: 2,
            letterSpacing: 0.5
          }}>
            AI-Powered Risk Analysis & Mission Planning
          </div>
        </div>
        
        <div className="chips">
          <div className="chip" style={{ background: "var(--accent-glow)", borderColor: "var(--brand)" }}>
            🧠 AI Models · <b style={{ color: "var(--brand)" }}>Active</b>
          </div>
          <div className="chip">
            📊 Objects · <b style={{ color: "var(--success)" }}>{withRisk.length}</b>
          </div>
          <div className="chip">
            ⚠️ Avg Risk · <b style={{ color: avgRisk > 0.3 ? "var(--danger)" : "var(--success)" }}>{(avgRisk*100).toFixed(1)}%</b>
          </div>
        </div>
      </div>

      <div className="grid">
        {/* Left Column - Controls & Analysis */}
        <div className="col-left">
          {/* Mission Overview */}
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
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Targets/Month</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand)" }}>{cadencePerMonth}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Success Rate</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>{Math.round(deorbitCompliance*100)}%</div>
              </div>
            </div>
            <div className="kv">
              <span>Space Weather:</span>
              <b style={{ color: dragMult > 1.3 ? "var(--warning)" : "var(--success)" }}>
                Drag {dragMult.toFixed(2)}×
              </b>
            </div>
            <div className="hint">
              💡 Adjust policy parameters below to optimize mission success rates and resource allocation.
            </div>
          </div>

          {/* Policy Controls */}
          <div className="card">
            <div className="card-title">⚙️ Policy Controls</div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Deorbit Compliance</span>
                <b style={{ color: "var(--brand)" }}>{Math.round(deorbitCompliance*100)}%</b>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={deorbitCompliance}
                onChange={e=>setCompliance(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
              <div className="hint">Percentage of planned debris removals that succeed</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Cleanup Cadence</span>
                <b style={{ color: "var(--brand)" }}>{cadencePerMonth}/month</b>
              </div>
              <input 
                type="range" 
                min="0" 
                max="20" 
                step="1"
                value={cadencePerMonth}
                onChange={e=>setCadence(parseInt(e.target.value))}
                style={{ width: "100%" }}
              />
              <div className="hint">Number of debris targets per month</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Space Weather Drag</span>
                <b style={{ color: dragMult > 1.3 ? "var(--warning)" : "var(--success)" }}>{dragMult.toFixed(2)}×</b>
              </div>
              <input 
                type="range" 
                min="0.7" 
                max="1.6" 
                step="0.01"
                value={dragMult}
                onChange={e=>setDrag(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
              <div className="hint">Atmospheric drag multiplier (Kp index effect)</div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={showKmeans} onChange={e=>setShowKmeans(e.target.checked)} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Show orbit clusters</span>
            </label>
          </div>

          {/* Risk Summary */}
          <div className="card">
            <div className="card-title">📊 Risk Analysis</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Average Collision Risk</span>
                <b style={{ color: avgRisk > 0.3 ? "var(--danger)" : "var(--success)" }}>
                  {(avgRisk*100).toFixed(1)}%
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
                  width: `${avgRisk * 100}%`,
                  background: avgRisk > 0.3 ? "var(--danger)" : "var(--success)",
                  borderRadius: 4
                }} />
              </div>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Debris Fraction</span>
                <b style={{ color: "var(--brand)" }}>{(debrisShare*100).toFixed(1)}%</b>
              </div>
              <div style={{ 
                height: 8, 
                background: "var(--line)", 
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${debrisShare * 100}%`,
                  background: "var(--brand)",
                  borderRadius: 4
                }} />
              </div>
            </div>

            <div style={{ 
              background: "rgba(255, 71, 87, 0.1)", 
              padding: 12, 
              borderRadius: 8,
              border: "1px solid var(--danger)"
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", marginBottom: 4 }}>
                ⚠️ Projected Collisions (12 months)
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>
                {projection.collisionsPerYear}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Under current policy settings
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recommendations & Clusters */}
        <div className="col-right">
          {/* AI Recommendations */}
          <div className="card">
            <div className="card-title">🤖 AI Recommendations (Next Sortie)</div>
            <div className="hint" style={{ marginBottom: 16 }}>
              Prioritized mix of highest-risk debris and operational satellites to defuse conjunction threats.
            </div>
            
            <div style={{ 
              background: "rgba(0, 212, 255, 0.05)", 
              borderRadius: 10, 
              padding: 12,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Mission Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>{recommendations.length}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Targets</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>
                    {recommendations.filter(r => r.type === "debris").length}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Debris Objects</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)" }}>
                    {recommendations.filter(r => r.type === "sat").length}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Satellites</div>
                </div>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {recommendations.map((r, idx) => (
                <div key={r.id} style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 80px 80px 80px",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "center"
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: r.type === "debris" ? "var(--danger)" : "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff"
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name ?? r.id}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {r.type === "debris" ? "💥 Debris" : "🛰️ Satellite"}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.altKm.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>km</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.incDeg.toFixed(1)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>°</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ 
                      fontSize: 13, 
                      fontWeight: 700,
                      color: r.risk > 0.5 ? "var(--danger)" : r.risk > 0.3 ? "var(--warning)" : "var(--success)"
                    }}>
                      {(r.risk*100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn primary" style={{ flex: 1 }}>
                📥 Export Mission Plan (CSV)
              </button>
              <button className="btn">
                📊 Generate Report
              </button>
            </div>
          </div>

          {/* Orbit Clusters */}
          {showKmeans && (
            <div className="card">
              <div className="card-title">🎯 Orbit Clusters</div>
              <div className="hint" style={{ marginBottom: 16 }}>
                Grouped by similar orbital parameters for efficient multi-capture missions.
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {km.groups.map((g, i)=>(
                  <div key={i} style={{
                    background: "rgba(0, 212, 255, 0.05)",
                    borderRadius: 10,
                    padding: 12,
                    border: "1px solid var(--line)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: 6, 
                        background: clusterColor(i) 
                      }} />
                      <strong style={{ fontSize: 13 }}>Cluster {i+1}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                      {g.length} objects • avg alt {avg(g.map(x=>x.altKm)).toFixed(0)} km
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      inc {avg(g.map(x=>x.incDeg)).toFixed(1)}°
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {g.slice(0,3).map(x=>(
                        <div key={x.id} style={{ 
                          fontSize: 10, 
                          color: "var(--muted)",
                          marginBottom: 2
                        }}>
                          {x.name ?? x.id} <span style={{ 
                            color: x.risk > 0.5 ? "var(--danger)" : "var(--brand)",
                            fontWeight: 600
                          }}>
                            {(x.risk*100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                      {g.length > 3 && (
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>
                          +{g.length-3} more...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function avg(a){return a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0}
function clusterColor(i){ return ["#58a6ff","#8b949e","#ff7b72","#3fb950","#ffa657"][i%5]; }