// src/pages/Reports.jsx
import React, { useMemo } from "react";
import { Sparkline, Donut } from "../components/SimpleCharts";
import { predictCollisionRisk } from "../ai/riskModel";
import RevenueChart from "../components/RevenueChart";

async function fetchTLEData() {
  try {
    const response = await fetch('/tle/custom.tle');
    const text = await response.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    const objects = [];
    for (const ln of lines) {
      if (!ln || ln.startsWith("#")) continue;
      const [name, alt, inc, raan, mm, kind, health, battery, fuel] = ln.split(/\s*,\s*/);
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
        battery: battery ? parseFloat(battery) : 100,
        fuel: fuel ? parseFloat(fuel) : 0
      });
    }
    return objects;
  } catch (error) {
    console.error("Failed to load TLE data:", error);
    return [];
  }
}

function useObjects() {
  const [objects, setObjects] = React.useState([]);
  
  React.useEffect(() => {
    fetchTLEData().then(setObjects);
  }, []);
  
  return objects.length ? objects : Array.from({length:26}).map((_,i)=>({
    id:`R-${i+1}`, name:`Obj-${i+1}`, altKm:500+(i%8)*35, incDeg:50+(i%5)*8,
    raanDeg:(i*33)%360, type:i<6?"debris":"sat", density:0.25+((i%6)*0.06),
    health: 100, battery: 100, fuel: 50
  }));
}

export default function Reports() {
  const objs = useObjects();
  const risks = useMemo(()=> objs.map(o => predictCollisionRisk({
      altKm:o.altKm, incDeg:o.incDeg, density:o.density ?? 0.2, dragMult:1.0, debris:o.type==="debris"?1:0
    }).p), [objs]);

  const top = [...objs].map((o,i)=>({o, r:risks[i]})).sort((a,b)=>b.r-a.r).slice(0,10);
  const debrisFrac = objs.filter(o=>o.type==="debris").length/objs.length;
  const avgRisk = risks.reduce((s,r)=>s+r,0)/risks.length;
  const highRiskCount = risks.filter(r=>r>0.3).length;

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          NASA <span>Analytics Dashboard</span>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 400, 
            color: "var(--muted)", 
            marginTop: 2,
            letterSpacing: 0.5
          }}>
            Mission Performance & Risk Assessment Reports
          </div>
        </div>
        
        <div className="chips">
          <div className="chip" style={{ background: "var(--accent-glow)", borderColor: "var(--brand)" }}>
            📊 Session · <b style={{ color: "var(--brand)" }}>Active</b>
          </div>
          <div className="chip">
            🛰️ Objects · <b style={{ color: "var(--success)" }}>{objs.length}</b>
          </div>
          <div className="chip">
            ⚠️ High Risk · <b style={{ color: highRiskCount > 5 ? "var(--danger)" : "var(--success)" }}>{highRiskCount}</b>
          </div>
        </div>
      </div>

      <div className="grid">
        {/* Left Column - Summary Stats */}
        <div className="col-left">
          {/* Revenue Analysis */}
        <div className="card">
            <div className="card-title">💰 Revenue Analysis</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16
            }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--brand)"
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  💥 Debris Collection
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand)" }}>
                  ${(objs.filter(o=>o.type==="debris").length * 2.5).toFixed(1)}M
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  @$2.5M per object
                </div>
              </div>
              <div style={{
                background: "linear-gradient(135deg, rgba(0, 255, 159, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--success)"
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  ♻️ Material Recycling
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>
                  ${(objs.filter(o=>o.type==="debris").length * 1.2).toFixed(1)}M
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  @$1.2M per recycling
                </div>
              </div>
            </div>
            
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16
            }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(255, 214, 0, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--warning)"
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  📡 Subscriptions
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--warning)" }}>
                  ${(objs.filter(o=>o.type==="sat").length * 0.8).toFixed(1)}M
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  @$800K per satellite/yr
                </div>
              </div>
              <div style={{
                background: "linear-gradient(135deg, rgba(77, 208, 225, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #4dd0e1"
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  🛡️ Insurance Savings
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#4dd0e1" }}>
                  ${(highRiskCount * 3.5).toFixed(1)}M
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  Risk mitigation value
                </div>
              </div>
            </div>

            <div style={{
              background: "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 102, 255, 0.15) 100%)",
              padding: 16,
              borderRadius: 10,
              border: "2px solid var(--brand)",
              textAlign: "center"
            }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                📈 Total Annual Revenue
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--brand)" }}>
                ${(
                  objs.filter(o=>o.type==="debris").length * 2.5 +
                  objs.filter(o=>o.type==="debris").length * 1.2 +
                  objs.filter(o=>o.type==="sat").length * 0.8 +
                  highRiskCount * 3.5
                ).toFixed(1)}M
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Projected annual revenue from all services
              </div>
            </div>
          </div>
          
          {/* Revenue Chart */}
          <RevenueChart />
          
          {/* Refueling Analysis */}
          <div className="card">
            <div className="card-title">⛽ Refueling Operations</div>
            {(() => {
              const satellites = objs.filter(o => o.type === "sat");
              const needsRefuel = satellites.filter(s => s.fuel < 30);
              const lowFuel = satellites.filter(s => s.fuel >= 30 && s.fuel < 50);
              const goodFuel = satellites.filter(s => s.fuel >= 50);
              const avgFuel = satellites.length ? satellites.reduce((sum, s) => sum + s.fuel, 0) / satellites.length : 0;
              
              return (
                <>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                    marginBottom: 16
                  }}>
                    <div style={{
                      background: "linear-gradient(135deg, rgba(255, 0, 0, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--danger)",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                        🔴 Critical
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--danger)" }}>
                        {needsRefuel.length}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        &lt;30% fuel
                      </div>
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg, rgba(255, 214, 0, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--warning)",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                        🟡 Low
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--warning)" }}>
                        {lowFuel.length}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        30-50% fuel
                      </div>
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg, rgba(0, 255, 159, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--success)",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                        ⛽ Good
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>
                        {goodFuel.length}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        &gt;50% fuel
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    background: "rgba(0, 212, 255, 0.05)",
                    padding: 16,
                    borderRadius: 10,
                    marginBottom: 16
                  }}>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                      Fleet Average Fuel Level
                    </div>
                    <div style={{ 
                      background: "rgba(13, 26, 48, 0.6)", 
                      borderRadius: 20, 
                      height: 8, 
                      position: "relative",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        background: avgFuel < 30 ? "var(--danger)" : avgFuel < 50 ? "var(--warning)" : "var(--success)",
                        width: `${avgFuel}%`,
                        height: "100%",
                        borderRadius: 20,
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 700, 
                      color: avgFuel < 30 ? "var(--danger)" : avgFuel < 50 ? "var(--warning)" : "var(--success)",
                      marginTop: 8
                    }}>
                      {avgFuel.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div style={{
                    background: "linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(13, 26, 48, 0.8) 100%)",
                    padding: 16,
                    borderRadius: 10,
                    border: "1px solid var(--brand)"
                  }}>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                      💰 Refueling Revenue Potential
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>
                      ${(needsRefuel.length * 1.5 + lowFuel.length * 0.8).toFixed(1)}M
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>
                      Critical: $1.5M each • Low: $800K each
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Right Column - Detailed Analysis */}
        <div className="col-right">
          {/* Mission Summary */}
          <div className="card">
            <div className="card-title">📈 Mission Summary</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              padding: 16,
              background: "rgba(0, 212, 255, 0.05)",
              borderRadius: 10,
              marginBottom: 16
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Total Objects</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--brand)" }}>{objs.length}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Tracked in this session</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Average Risk</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: avgRisk > 0.3 ? "var(--danger)" : "var(--success)" }}>
                  {(avgRisk*100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Collision probability</div>
              </div>
            </div>
            
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              padding: 16,
              background: "rgba(255, 71, 87, 0.05)",
              borderRadius: 10,
              border: "1px solid var(--danger)"
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>High Risk Objects</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>{highRiskCount}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Risk &gt; 30%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Debris Fraction</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--warning)" }}>{(debrisFrac*100).toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Of total catalog</div>
              </div>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="card">
            <div className="card-title">📊 Risk Distribution</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Debris vs Satellites</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 120, height: 120 }}>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    background: "conic-gradient(from 0deg, var(--danger) 0deg, var(--danger) " + (debrisFrac * 360) + "deg, var(--line) " + (debrisFrac * 360) + "deg, var(--line) 360deg)"
                  }} />
                  <div style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    background: "var(--card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--brand)"
                  }}>
                    {(debrisFrac*100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: "var(--danger)" }} />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Debris ({objs.filter(o=>o.type==="debris").length})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: "var(--line)" }} />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Satellites ({objs.filter(o=>o.type==="sat").length})</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hint">
              Higher debris fraction increases collision risk due to uncontrolled orbital decay.
        </div>
      </div>

          {/* Risk Trends */}
          <div className="card">
            <div className="card-title">📈 Risk Trends</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Top-10 Risk Values</div>
              <div style={{ 
                height: 60, 
                background: "rgba(0, 212, 255, 0.05)", 
                borderRadius: 8,
                padding: 8,
                display: "flex",
                alignItems: "end",
                gap: 2
              }}>
                {top.slice(0, 10).map((item, i) => (
                  <div key={i} style={{
                    width: 8,
                    height: `${(item.r * 100)}%`,
                    background: item.r > 0.5 ? "var(--danger)" : item.r > 0.3 ? "var(--warning)" : "var(--success)",
                    borderRadius: 2,
                    minHeight: 2
                  }} />
                ))}
              </div>
            </div>
            
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Risk distribution across highest-threat objects in current session.
            </div>
          </div>
          
          {/* Top Risk Objects */}
          <div className="card">
            <div className="card-title">⚠️ Top Risk Objects</div>
            <div className="hint" style={{ marginBottom: 16 }}>
              Highest collision risk objects requiring immediate attention.
            </div>
            
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {top.map((item, idx) => (
                <div key={item.o.id} style={{
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
                    background: item.r > 0.5 ? "var(--danger)" : item.r > 0.3 ? "var(--warning)" : "var(--success)",
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
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.o.name ?? item.o.id}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {item.o.type === "debris" ? "💥 Debris" : "🛰️ Satellite"}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.o.altKm.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>km</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.o.incDeg.toFixed(1)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>°</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ 
                      fontSize: 13, 
                      fontWeight: 700,
                      color: item.r > 0.5 ? "var(--danger)" : item.r > 0.3 ? "var(--warning)" : "var(--success)"
                    }}>
                      {(item.r*100).toFixed(1)}%
                    </div>
                  </div>
            </div>
          ))}
            </div>

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn primary" style={{ flex: 1 }}>
                📥 Export Risk Report (PDF)
              </button>
              <button className="btn">
                📊 Generate Charts
              </button>
            </div>
          </div>

          {/* Altitude Distribution */}
          <div className="card">
            <div className="card-title">🌍 Altitude Distribution</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Object Distribution by Altitude</div>
              <div style={{ 
                height: 120, 
                background: "rgba(0, 212, 255, 0.05)", 
                borderRadius: 8,
                padding: 12,
                display: "flex",
                alignItems: "end",
                gap: 4,
                justifyContent: "space-between"
              }}>
                {[400, 500, 600, 700, 800, 900].map(alt => {
                  const count = objs.filter(o => o.altKm >= alt && o.altKm < alt + 100).length;
                  const maxCount = Math.max(...[400, 500, 600, 700, 800, 900].map(a => 
                    objs.filter(o => o.altKm >= a && o.altKm < a + 100).length
                  ));
                  return (
                    <div key={alt} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 20,
                        height: `${(count / maxCount) * 80}px`,
                        background: alt < 500 ? "var(--danger)" : alt < 700 ? "var(--warning)" : "var(--success)",
                        borderRadius: 2,
                        minHeight: 2
                      }} />
                      <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
                        {alt}km<br />({count})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="hint">
              Lower altitudes show higher collision risk due to atmospheric drag effects.
            </div>
          </div>

          {/* Export Options */}
          <div className="card">
            <div className="card-title">📤 Export Options</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button className="btn">
                📊 CSV Data Export
              </button>
              <button className="btn">
                📄 PDF Report
              </button>
              <button className="btn">
                📈 Chart Images
              </button>
              <button className="btn">
                🔗 Share Link
              </button>
            </div>
            <div className="hint" style={{ marginTop: 12 }}>
              Export mission data, risk assessments, and visualizations for stakeholder reports.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}