import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import GibsEarth from "./GibsEarth.jsx";

const OVERLAY_LAYERS = {
  atmoRivers: "MERRA-2_Integrated_Water_Vapor_Column_Daily_Mean",
  elNino: "GHRSST_L4_MUR_SST_Anomalies",
  none: null
};

export default function Scene({ dateStr, overlay }) {
  const overlayConfig = useMemo(() => {
    const layerId = OVERLAY_LAYERS[overlay];
    if (!layerId) return null;
    return {
      layerId,
      dateStr,
      opacity: 0.75
    };
  }, [overlay, dateStr]);

  return (
    <Canvas camera={{ position: [0, 0, 2.6], fov: 50 }} style={{ position:"absolute", inset:0 }}>
      <color attach="background" args={["#020510"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Stars radius={120} depth={60} count={6000} factor={4} fade />

      <Suspense fallback={
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial color="#0a0f18" wireframe />
        </mesh>
      }>
        <GibsEarth dateStr={dateStr} overlay={overlayConfig} />
      </Suspense>

      <OrbitControls enableDamping />
    </Canvas>
  );
}
