import React, { useState } from "react";
import ClawDemo from "../components/ClawDemo";
import Scene from "../components/Scene";

export default function Simulation() {
  const [activeView, setActiveView] = useState("earth"); // "earth" | "claw"
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [overlay, setOverlay] = useState("none");

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          NASA <span>Simulation Suite</span>
        </div>
        
        <div className="chips">
          <button
            className={`chip ${activeView === "earth" ? "active" : ""}`}
            onClick={() => setActiveView("earth")}
            style={{ 
              cursor: "pointer",
              borderColor: activeView === "earth" ? "var(--brand)" : "var(--line)"
            }}
          >
            🌍 Earth View
          </button>
          <button
            className={`chip ${activeView === "claw" ? "active" : ""}`}
            onClick={() => setActiveView("claw")}
            style={{ 
              cursor: "pointer",
              borderColor: activeView === "claw" ? "var(--brand)" : "var(--line)"
            }}
          >
            🤖 Debris Collection Demo
          </button>
        </div>
      </div>

      {activeView === "earth" ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Earth Visualization Controls</div>
            <div className="btn-row">
              <button
                className={`btn ${overlay === "atmoRivers" ? "primary" : ""}`}
                onClick={() => setOverlay("atmoRivers")}
              >
                Atmospheric Rivers
              </button>
              <button
                className={`btn ${overlay === "elNino" ? "primary" : ""}`}
                onClick={() => setOverlay("elNino")}
              >
                El Niño Impact
              </button>
              <button className="btn" onClick={() => setOverlay("none")}>
                Clear Overlay
              </button>
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Date:</span>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                style={{
                  background: "rgba(18, 32, 51, 0.8)",
                  color: "#dbe9ff",
                  border: "1px solid var(--line-bright)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13
                }}
              />
            </div>
            <div className="hint">
              NASA GIBS satellite imagery showing real-time environmental data overlayed on Earth.
            </div>
          </div>

          <div className="card card-3d">
            <div style={{ width: "100%", height: "70vh", minHeight: 500 }}>
              <Scene dateStr={dateStr} overlay={overlay} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">About Earth View</div>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
              This 3D Earth visualization uses NASA's Global Imagery Browse Services (GIBS) 
              to display real-time satellite imagery. Toggle between different environmental 
              data layers to observe atmospheric phenomena, climate patterns, and their impacts 
              on Low Earth Orbit operations.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Debris Collection Mission</div>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              Watch the autonomous debris collection system in action. The satellite extends 
              its robotic arm, captures space debris using precision claw mechanism, and 
              safely stows the debris inside the service bay for deorbiting or recycling.
            </p>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: 12,
              padding: 12,
              background: "rgba(0, 212, 255, 0.05)",
              borderRadius: 10,
              border: "1px solid var(--line)"
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Mission Phase
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--brand)" }}>
                  Active Debris Removal
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Technology
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>
                  Robotic Claw System
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Target
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>
                  Non-functional Debris
                </div>
              </div>
            </div>
          </div>

          <div className="card card-3d" style={{ minHeight: 600 }}>
            <ClawDemo />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Mission Sequence</div>
            <ol style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
              <li><strong style={{ color: "var(--brand)" }}>Approach:</strong> Service satellite approaches the target debris using precision navigation</li>
              <li><strong style={{ color: "var(--brand)" }}>Extend Arm:</strong> Robotic arm extends from the satellite bus toward the debris</li>
              <li><strong style={{ color: "var(--brand)" }}>Capture:</strong> Claw mechanism closes around the debris, securing it</li>
              <li><strong style={{ color: "var(--brand)" }}>Retract:</strong> Arm retracts, bringing the debris closer to the satellite</li>
              <li><strong style={{ color: "var(--brand)" }}>Stow:</strong> Debris is transferred into the internal bay for safe storage</li>
              <li><strong style={{ color: "var(--brand)" }}>Complete:</strong> Mission complete - ready for next target or deorbit burn</li>
            </ol>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Business Value</div>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
              gap: 16 
            }}>
              <div>
                <h4 style={{ color: "var(--brand)", fontSize: 14, marginBottom: 8 }}>
                  Revenue Generation
                </h4>
                <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                  Governments and satellite operators pay for debris removal services 
                  to protect their assets and comply with orbital sustainability regulations.
                </p>
              </div>
              <div>
                <h4 style={{ color: "var(--success)", fontSize: 14, marginBottom: 8 }}>
                  Orbital Recycling
                </h4>
                <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                  Collected debris can be processed into 3D printing feedstock for 
                  in-space manufacturing, creating a circular economy in orbit.
                </p>
              </div>
              <div>
                <h4 style={{ color: "var(--warning)", fontSize: 14, marginBottom: 8 }}>
                  Risk Mitigation
                </h4>
                <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                  Reducing collision risks protects billions in satellite infrastructure 
                  and ensures sustainable access to Low Earth Orbit.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}