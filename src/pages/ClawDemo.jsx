// src/pages/ClawDemo.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";

/* -------------------- helpers -------------------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function ease(t) { return t * t * (3 - 2 * t); } // smoothstep-ish

// Reparent while preserving world transform (pos/rot/scale)
function reparentPreserveWorld(child, newParent) {
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScl = new THREE.Vector3();

  child.getWorldPosition(worldPos);
  child.getWorldQuaternion(worldQuat);
  child.getWorldScale(worldScl);

  newParent.add(child);

  // Convert world -> local of newParent
  const invParentQuat = new THREE.Quaternion();
  newParent.getWorldQuaternion(invParentQuat).invert();

  child.position.copy(worldPos);
  child.position.copy(newParent.worldToLocal(child.position.clone()));

  child.quaternion.copy(worldQuat);
  child.quaternion.premultiply(invParentQuat);

  // scale: approximate (most rigs use uniform scales here)
  const parentScale = new THREE.Vector3();
  newParent.getWorldScale(parentScale);
  child.scale.set(
    worldScl.x / parentScale.x,
    worldScl.y / parentScale.y,
    worldScl.z / parentScale.z
  );
}

/* -------------------- scene primitives -------------------- */
function Bus({ color = "#4dd0e1" }) {
  // Cylinder bus with a rectangular "bay" opening + a named mount inside
  return (
    <group>
      {/* main bus */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.9, 24, 1, false]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* bay opening (visual) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.2, 0, 0]}>
        <boxGeometry args={[0.18, 0.28, 0.26]} />
        <meshStandardMaterial color="#1a2845" />
      </mesh>

      {/* bay interior lighting */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.15, 0, 0]}>
        <boxGeometry args={[0.12, 0.24, 0.22]} />
        <meshStandardMaterial color="#00d4ff" emissive="#001122" />
      </mesh>

      {/* named bay mount used for stow hand-off */}
      <group name="bayMount" position={[0.1, 0, 0]} />
    </group>
  );
}

function ClawArm({ armExt, jaw, gripRef }) {
  // armExt: 0..1 extension amount
  // jaw: 0..1 closed fraction
  return (
    <group>
      {/* base hinge */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.1, 16]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* arm segments for more realistic look */}
      <mesh position={[0.15 + 0.1 * armExt, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2 + 0.2 * armExt, 0.06, 0.06]} />
        <meshStandardMaterial color="#4dd0e1" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* second arm segment */}
      <mesh position={[0.35 + 0.3 * armExt, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15 + 0.3 * armExt, 0.05, 0.05]} />
        <meshStandardMaterial color="#7dd3fc" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* claw mount (at boom end) */}
      <group position={[0.5 + 0.4 * armExt, 0, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color="#00d4ff" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* enhanced jaws with better visibility */}
        <mesh position={[0, 0.04, 0]} rotation={[0, 0, jaw * 0.8]}>
          <boxGeometry args={[0.1, 0.025, 0.03]} />
          <meshStandardMaterial color="#ffd600" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.04, 0]} rotation={[0, 0, -jaw * 0.8]}>
          <boxGeometry args={[0.1, 0.025, 0.03]} />
          <meshStandardMaterial color="#ffd600" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* claw tips */}
        <mesh position={[0.05, 0.04, 0]} rotation={[0, 0, jaw * 0.8]}>
          <coneGeometry args={[0.015, 0.03, 8]} />
          <meshStandardMaterial color="#ff6b6b" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0.05, -0.04, 0]} rotation={[0, 0, -jaw * 0.8]}>
          <coneGeometry args={[0.015, 0.03, 8]} />
          <meshStandardMaterial color="#ff6b6b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* grip pivot (attach point) */}
        <group ref={gripRef} position={[0.06, 0, 0]} />
      </group>
    </group>
  );
}

const Debris = React.forwardRef(function Debris(_, ref) {
  return (
    <group ref={ref}>
      {/* main debris body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.06, 0.06]} />
        <meshStandardMaterial color="#ff7b72" roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* debris details */}
      <mesh position={[0.03, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.02, 0.04, 0.04]} />
        <meshStandardMaterial color="#ff4757" roughness={0.9} />
      </mesh>
      
      {/* metallic parts */}
      <mesh position={[-0.03, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.015, 0.02, 0.02]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* warning lights */}
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color="#ffd600" emissive="#ffd600" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
});

/* -------------------- main choreographer -------------------- */
function Sequence({ speed = 1, pause = false, loop = false, setStatus }) {
  const chaserRef = useRef();          // whole service craft
  const gripRef = useRef();
  const debrisRef = useRef();
  const bayMountRef = useRef();

  const [armExt, setArmExt] = useState(0);
  const [jaw, setJaw] = useState(0);   // 0 open, 1 closed
  const [phase, setPhase] = useState("approach");
  const tRef = useRef(0);
  const attachedRef = useRef(false);

  // initial placements
  useEffect(() => {
    if (!chaserRef.current) return;
    chaserRef.current.position.set(-1.8, 0, 0);
    chaserRef.current.rotation.set(0, 0.15, 0);
    debrisRef.current?.position.set(0, -0.02, 0.02);
  }, []);

  // find bay mount by name under the chaser
  useEffect(() => {
    if (!chaserRef.current) return;
    chaserRef.current.traverse((n) => {
      if (n.name === "bayMount") bayMountRef.current = n;
    });
  }, []);

  function setPhaseStatus(p) {
    setPhase(p);
    setStatus?.(p);
  }

  useFrame((_, dt) => {
    if (!chaserRef.current || !debrisRef.current) return;
    const sdt = pause ? 0 : clamp(dt * speed, 0, 0.05);
    tRef.current += sdt;

    if (phase === "approach") {
      const p = ease(clamp(tRef.current / 2.0, 0, 1));
      chaserRef.current.position.lerp(new THREE.Vector3(-0.35, 0, 0), p * sdt * 6);
      if (p >= 0.999) { tRef.current = 0; setPhaseStatus("extend"); }
    }
    else if (phase === "extend") {
      const p = ease(clamp(tRef.current / 1.2, 0, 1));
      setArmExt(p);
      if (p >= 0.999) { tRef.current = 0; setPhaseStatus("close"); }
    }
    else if (phase === "close") {
      const p = ease(clamp(tRef.current / 0.9, 0, 1));
      setJaw(p);

      // attach when near and almost closed
      const grip = gripRef.current, debris = debrisRef.current;
      if (!attachedRef.current && grip && debris) {
        const dist = grip.getWorldPosition(new THREE.Vector3())
          .distanceTo(debris.getWorldPosition(new THREE.Vector3()));
        if (dist < 0.06 && p > 0.6) {
          reparentPreserveWorld(debris, grip);
          attachedRef.current = true;
        }
      }
      if (p >= 0.999) { tRef.current = 0; setPhaseStatus("retract"); }
    }
    else if (phase === "retract") {
      const p = ease(clamp(tRef.current / 1.2, 0, 1));
      setArmExt(1 - p);
      
      // Keep debris attached to grip during retraction
      if (attachedRef.current && gripRef.current && debrisRef.current) {
        // Debris should stay with the grip, no extra movement needed as it's parented
      }
      
      if (p >= 0.999) { tRef.current = 0; setPhaseStatus("stow"); }
    }
    else if (phase === "stow") {
      // Move the whole satellite closer to position debris into bay
      chaserRef.current.position.lerp(new THREE.Vector3(-0.15, 0, 0), sdt * 2);
      
      // Check if debris (still attached to grip) is close enough to bay
      if (bayMountRef.current && gripRef.current && debrisRef.current && attachedRef.current) {
        const gripW = gripRef.current.getWorldPosition(new THREE.Vector3());
        const bayW  = bayMountRef.current.getWorldPosition(new THREE.Vector3());
        
        // When grip is close to bay, transfer debris from grip to bay
        if (gripW.distanceTo(bayW) < 0.12) {
          reparentPreserveWorld(debrisRef.current, bayMountRef.current);
          // Animate debris moving into bay center
          const bayLocal = bayMountRef.current.worldToLocal(gripW.clone());
          debrisRef.current.position.copy(bayLocal);
          tRef.current = 0;
          setPhaseStatus("moveIn");
        }
      }
    }
    else if (phase === "moveIn") {
      // Smoothly move debris to center of bay
      if (debrisRef.current && bayMountRef.current) {
        debrisRef.current.position.lerp(new THREE.Vector3(0, 0, 0), sdt * 5);
        const dist = debrisRef.current.position.length();
        if (dist < 0.02) {
          tRef.current = 0;
          setPhaseStatus("release");
        }
      }
    }
    else if (phase === "release") {
      const p = ease(clamp(tRef.current / 0.8, 0, 1));
      setJaw(1 - p);
      if (p >= 0.999) { tRef.current = 0; setPhaseStatus("done"); }
    }
    else if (phase === "done") {
      if (loop) {
        attachedRef.current = false;
        setArmExt(0); setJaw(0);
        // put debris back into scene (space) for replay
        if (debrisRef.current && chaserRef.current.parent) {
          reparentPreserveWorld(debrisRef.current, chaserRef.current.parent);
          debrisRef.current.position.set(0.04, -0.02, 0.02);
        }
        chaserRef.current.position.set(-1.8, 0, 0);
        tRef.current = 0;
        setPhaseStatus("approach");
      }
    }
  });

  return (
    <group>
      {/* chaser spacecraft */}
      <group ref={chaserRef} position={[-1.8, 0, 0]}>
        <Bus />
        <group position={[0.2, 0, 0]}>
          <ClawArm armExt={armExt} jaw={jaw} gripRef={gripRef} />
        </group>
      </group>

      {/* floating target */}
      <Debris ref={debrisRef} />
    </group>
  );
}

/* -------------------- page shell -------------------- */
export default function ClawDemo() {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1.6);
  const [loop, setLoop] = useState(false);
  const [status, setStatus] = useState("approach");

  return (
    <div className="page p-4">
      <div className="row items-center gap-3 mb-3">
        <h3 className="muted">Claw capture demo</h3>
        <div className="spacer" />
        <button className="btn" onClick={() => window.location.reload()}>Reset</button>
        <button className="btn" onClick={() => setPaused(p => !p)}>{paused ? "Resume" : "Pause"}</button>
        <label className="muted" style={{ marginLeft: 12 }}>Speed</label>
        <input
          type="range" min={0.25} max={3} step={0.05}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          style={{ width: 220 }}
        />
        <span className="muted" style={{ width: 48, textAlign: "right" }}>
          {speed.toFixed(2)}×
        </span>
        <label className="row items-center gap-2">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          <span className="muted">Loop</span>
        </label>
      </div>

      <div className="card" style={{ height: 560 }}>
        <Canvas camera={{ position: [0, 0.8, 2.2], fov: 45 }}>
          <color attach="background" args={["#020510"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 3, 2]} intensity={1.2} castShadow />
          <pointLight position={[0, 1, 1]} intensity={0.8} color="#00d4ff" />
          <pointLight position={[-1, 0, 1]} intensity={0.5} color="#4dd0e1" />
          <Stars radius={75} depth={40} count={1200} factor={4} fade />
          <Sequence speed={speed} pause={paused} loop={loop} setStatus={setStatus} />
          <OrbitControls enablePan={false} />
        </Canvas>
      </div>

      <div className="card mt-2">
        <div className="muted">
          <strong>Status:</strong> {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
        <div className="muted small">
          Sequence: <em>approach → extend arm → close claw (attach) → retract → stow → move into bay → release → done</em>.
        </div>
      </div>
    </div>
  );
}
