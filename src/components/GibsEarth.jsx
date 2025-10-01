import { useEffect, useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

/** Build a global (equirect) WMS GetMap URL from GIBS. */
function gibsWmsUrl(layer, date, format = "image/jpeg", transparent = false, w = 4096, h = 2048) {
  const base = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
  const params = [
    "SERVICE=WMS",
    "REQUEST=GetMap",
    "VERSION=1.3.0",
    `FORMAT=${format}`,
    `LAYERS=${encodeURIComponent(layer)}`,
    "CRS=EPSG:4326",
    "BBOX=-90,-180,90,180",
    `WIDTH=${w}`,
    `HEIGHT=${h}`,
    `TIME=${date}`
  ];
  if (transparent) params.push("TRANSPARENT=TRUE");
  return `${base}?${params.join("&")}`;
}

/**
 * Props:
 *  - dateStr: base imagery date (YYYY-MM-DD)
 *  - baseLayer: GIBS id for base (default VIIRS True Color)
 *  - overlay: { layerId, dateStr, opacity }  (optional)
 */
export default function GibsEarth({
  dateStr,
  baseLayer = "VIIRS_SNPP_CorrectedReflectance_TrueColor",
  overlay = null
}) {
  const baseUrl = useMemo(
    () => gibsWmsUrl(baseLayer, dateStr || new Date().toISOString().slice(0, 10), "image/jpeg"),
    [baseLayer, dateStr]
  );

  // Base texture (True Color)
  const baseTex = useLoader(THREE.TextureLoader, baseUrl);
  baseTex.colorSpace = THREE.SRGBColorSpace;
  baseTex.anisotropy = 8;

  // Optional overlay texture (loaded manually so it can be conditional)
  const [ovTex, setOvTex] = useState(null);
  const [overlayError, setOverlayError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    if (!overlay?.layerId) {
      setOvTex(null);
      setOverlayError(null);
      return;
    }
    
    const url = gibsWmsUrl(
      overlay.layerId,
      overlay.dateStr || dateStr || new Date().toISOString().slice(0, 10),
      "image/png",
      true
    );
    
    console.log('Loading GIBS overlay:', {
      layer: overlay.layerId,
      date: overlay.dateStr || dateStr,
      url
    });
    
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (t) => {
        if (cancelled) return;
        console.log('Overlay texture loaded successfully:', overlay.layerId);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setOvTex(t);
        setOverlayError(null);
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          console.log(`Loading overlay: ${percent}%`);
        }
      },
      (error) => {
        if (cancelled) return;
        console.error('Failed to load overlay texture:', error, url);
        setOverlayError(error);
        setOvTex(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [overlay?.layerId, overlay?.dateStr, dateStr]);

  return (
    <>
      {/* Base globe */}
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={baseTex} roughness={1} metalness={0} />
      </mesh>

      {/* Overlay globe (slightly larger radius to avoid z-fighting) */}
      {ovTex && (
        <mesh>
          <sphereGeometry args={[1.003, 128, 128]} />
          <meshStandardMaterial
            map={ovTex}
            transparent
            opacity={overlay?.opacity ?? 0.75}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
