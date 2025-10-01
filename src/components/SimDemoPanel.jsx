// src/components/SimDemoPanel.jsx
import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { eciFromElems, dvBetween, dvForRoute } from "../utils/sim.js";

/** Simple always-visible Earth (no remote textures) */
function Earth() {
  return (
    <mesh>
      <sphereGeometry args={[1, 96, 96]} />
      <meshStandardMaterial color="#0b1220" roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

function Tug({ pos, heading }) {
  return (
    <group position={pos} rotation={[0, heading, 0]}>
      <mesh>
        <sphereGeometry args={[0.016, 24, 24]} />
        <meshStandardMaterial color="#a7f3d0" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <coneGeometry args={[0.01, 0.03, 16]} />
        <meshStandardMaterial color="#a7f3d0" />
      </mesh>
    </group>
  );
}

function DebrisPin({ pos, done }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.01, 16, 16]} />
      <meshStandardMaterial color={done ? "#22c55e" : "#7dd3fc"} />
    </mesh>
  );
}

function RoutePath({ points }) {
  if (!points || points.length < 2) return null;
  return <Line points={points} color="#ffffff" opacity={0.35} transparent />;
}

/** Animator: runs INSIDE Canvas so useFrame is valid */
function Animator({
  running,
  plan,
  routePoints,
  tugRef,
  collectedIds,
  setCollectedIds,
  setDvUsed,
  setElapsed,
  dragModifier,
  stopRun
}) {
  useFrame((_, dt) => {
    if (!running || !plan || !routePoints || routePoints.length === 0) return;

    const s = tugRef.current;
    const target = routePoints[s.idx];
    if (!target) return;

    const cur = s.pos;
    const dir = new THREE.Vector3().subVectors(target, cur);
    const dist = dir.length();
    if (dist > 1e-6) dir.normalize();

    const speed = 0.25;
    const step = Math.min(dist, speed * dt);
    cur.addScaledVector(dir, step);
    s.heading = Math.atan2(dir.x, dir.z);
    setElapsed(e => e + dt);

    if (dist <= 0.02) {
      const reachedId = plan.route.order[s.idx];
      if (!collectedIds.includes(reachedId)) {
        if (s.idx > 0) {
          const A = plan.targets.find(t => t.id === plan.route.order[s.idx - 1]);
          const B = plan.targets.find(t => t.id === reachedId);
          const dv = dvBetween(A, B) * (dragModifier || 1.0);
          setDvUsed(v => Math.round(v + dv));
        }
        setCollectedIds(ids => [...ids, reachedId]);
      }
      s.idx += 1;
      if (s.idx >= routePoints.length) stopRun();
    }
  });

  return null;
}

export default function SimDemoPanel({ kp = 3, dragModifier = 1.0 }) {
  const [plan, setPlan] = useState(null);
  const [collectedIds, setCollectedIds] = useState([]);
  const [dvUsed, setDvUsed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  function loadDemo() {
    const demo = {
      targets: [
        { id: "T01", alt_km: 550, inc_deg: 53, raan_deg: 40, anomaly_deg: 90 },
        { id: "T10", alt_km: 630, inc_deg: 97.5, raan_deg: 300, anomaly_deg: 350 },
        { id: "T15", alt_km: 780, inc_deg: 30, raan_deg: 330, anomaly_deg: 15 }
      ],
      route: { order: ["T01", "T10", "T15"], dvBudget_mps: 1800 },
      meta: { kp, dragModifier, issuedAt: new Date().toISOString() }
    };
    setPlan(demo);
    setCollectedIds([]);
    setDvUsed(0);
    setElapsed(0);
    setRunning(false);
  }

  const targets3d = useMemo(() => {
    if (!plan) return [];
    return plan.targets.map(t => ({ ...t, pos: eciFromElems(t.alt_km, t.inc_deg, t.raan_deg, t.anomaly_deg) }));
  }, [plan]);

  const routePoints = useMemo(() => {
    if (!plan || !plan.route?.order) return null;
    const pts = plan.route.order.map(id => {
      const t = targets3d.find(x => x.id === id);
      return t ? new THREE.Vector3(...t.pos) : null;
    }).filter(Boolean);
    return pts;
  }, [plan, targets3d]);

  const tugRef = useRef({ pos: new THREE.Vector3(0, 0, 1.7), heading: 0, idx: 0 });

  function startRun() { if (!plan) loadDemo(); setRunning(true); }
  function pauseRun() { setRunning(false); }
  function resetRun() {
    setRunning(false); setCollectedIds([]); setDvUsed(0); setElapsed(0);
    tugRef.current = { pos: new THREE.Vector3(0, 0, 1.7), heading: 0, idx: 0 };
  }
  function stopRun() { setRunning(false); }

  const dvPlanned = useMemo(() => {
    if (!plan) return 0;
    return Math.round(dvForRoute(plan.route.order, plan.targets) * (dragModifier || 1.0));
  }, [plan, dragModifier]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <Canvas camera={{ position: [0, 0.2, 2.6], fov: 50 }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#000"]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />

        <Earth />
        {routePoints && <RoutePath points={routePoints} />}
        {targets3d.map(t => (<DebrisPin key={t.id} pos={t.pos} done={collectedIds.includes(t.id)} />))}
        <Tug pos={tugRef.current.pos} heading={tugRef.current.heading} />

        <Animator
          running={running}
          plan={plan}
          routePoints={routePoints}
          tugRef={tugRef}
          collectedIds={collectedIds}
          setCollectedIds={setCollectedIds}
          setDvUsed={setDvUsed}
          setElapsed={setElapsed}
          dragModifier={dragModifier}
          stopRun={stopRun}
        />

        <OrbitControls enableDamping />
      </Canvas>

      {/* Controls */}
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", gap: 8, alignItems: "center", zIndex: 5 }}>
        <button onClick={loadDemo} style={btn}>Send Demo Plan</button>
        <button onClick={startRun} style={btn} disabled={running && !!plan}>Start</button>
        <button onClick={pauseRun} style={btn} disabled={!running}>Pause</button>
        <button onClick={resetRun} style={btn}>Reset</button>
        <span style={badge}>Kp {kp} · Drag {Number(dragModifier).toFixed(2)}×</span>
      </div>

      {/* Telemetry */}
      <div style={{ position: "absolute", right: 12, top: 12, zIndex: 5 }}>
        <div style={metric}>
          <div style={k}>Simulation Telemetry</div>
          {!plan ? (
            <div style={{ fontSize: 14, opacity: .9 }}>Click “Send Demo Plan”</div>
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Planned Δv: <b>{dvPlanned} m/s</b><br />
              Used Δv: <b>{dvUsed} m/s</b><br />
              Collected: <b>{collectedIds.length}</b> / {plan?.route?.order?.length || 0}<br />
              Elapsed: <b>{Math.round(elapsed)} s</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: "8px 12px",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 10,
  background: "rgba(255,255,255,.06)",
  color: "#fff",
  cursor: "pointer"
};
const badge = {
  padding: "4px 8px",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 999,
  background: "rgba(255,255,255,.06)"
};
const metric = {
  minWidth: 240,
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,.07)"
};
const k = { fontSize: 11, letterSpacing: ".5px", textTransform: "uppercase", opacity: .72 };
