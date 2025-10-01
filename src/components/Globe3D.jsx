import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../store/appState";
import CollisionWarnings from "./CollisionWarnings";
import { detectCollisions, calculateLifecycle, getLifecycleColor, hexToNumber } from "../utils/collisionDetect";

/* ------------------ External libs (Three.js & satellite.js) ------------------ */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}
async function loadThreeAndSatellite() {
  if (!window.THREE) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
  }
  if (!window.satellite) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/satellite.js/6.0.0/satellite.min.js");
  }
  const THREE = window.THREE;
  const sat = window.satellite;
  if (!THREE || !sat) throw new Error("THREE or satellite.js unavailable");
  return { THREE, sat };
}

/* --------------------------- GIBS / BlueMarble --------------------------- */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(id); resolve(v); },
                 (e) => { clearTimeout(id); reject(e); });
  });
}
function gibsWmsUrl(layer, date, { w = 2048, h = 1024, format = "image/png", transparent = false } = {}) {
  const base = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
  const p = [
    "SERVICE=WMS","REQUEST=GetMap","VERSION=1.3.0",
    `FORMAT=${format}`,`LAYERS=${encodeURIComponent(layer)}`,
    "CRS=EPSG:4326","BBOX=-90,-180,90,180",
    `WIDTH=${w}`,`HEIGHT=${h}`
  ];
  if (!layer.toLowerCase().includes("bluemarble")) p.push(`TIME=${date}`);
  if (transparent) p.push("TRANSPARENT=TRUE");
  return `${base}?${p.join("&")}`;
}
const BASE_LAYERS = [
  "VIIRS_SNPP_CorrectedReflectance_TrueColor",
  "MODIS_Terra_CorrectedReflectance_TrueColor",
  "MODIS_Aqua_CorrectedReflectance_TrueColor",
  "BlueMarble_NextGeneration",
];
const AR_LAYERS = [
  "MERRA-2_Integrated_Water_Vapor_Column_Daily_Mean",
  "MERRA-2_Integrated_Water_Vapor_Column_Monthly_Mean",
  "IMERG_Precipitation_Rate",
];
const EN_LAYERS = [
  "GHRSST_L4_MUR25_SST_Anomalies",
  "GHRSST_L4_MUR_SST_Anomalies",
  "GHRSST_L4_MUR25_SST_Anomaly",
];
const STATIC_NASA = [
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74419/land_shallow_topo_2048.jpg",
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.png",
];
async function loadStaticBlueMarble(THREE) {
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  for (const url of STATIC_NASA) {
    try {
      const tex = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
      if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 8;
      return { texture: tex, layer: "BlueMarble_Fallback" };
    } catch {}
  }
  return null;
}
async function progressiveGibsTexture(THREE, layerList, dateStr, { transparent }) {
  const sizes = [{w:2048,h:1024,timeout:9000},{w:1536,h:768,timeout:9000},{w:1024,h:512,timeout:9000}];
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  for (const layer of layerList) {
    for (const s of sizes) {
      const url = gibsWmsUrl(layer, dateStr, { ...s, format:"image/png", transparent });
      try {
        const tex = await withTimeout(new Promise((res, rej) => loader.load(url, res, undefined, rej)), s.timeout);
        if (tex.encoding !== undefined) tex.encoding = window.THREE.sRGBEncoding;
        tex.anisotropy = 8;
        return { texture: tex, layer, size: s };
      } catch {}
    }
  }
  return await loadStaticBlueMarble(window.THREE);
}

/* ------------------------------- TLE utils ------------------------------- */
async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("fetch failed: " + url);
  return await res.text();
}
function parseTLEText(tleText) {
  const lines = tleText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Detect synthetic CSV (comma in first data line or '#')
  if (lines[0]?.startsWith("#") || (lines[0] && lines[0].includes(","))) {
    // Format: name,alt_km,inc_deg,raan_deg,mean_motion_rev_per_day,kind,health,battery
    const out = [];
    for (const ln of lines) {
      if (!ln || ln.startsWith("#")) continue;
      const [name, alt, inc, raan, mm, kind, health, battery] = ln.split(/\s*,\s*/);
      if (!name || !alt || !inc || !raan || !mm) continue;
      out.push({
        mode: "synthetic",
        name,
        a_km: 6371 + parseFloat(alt),
        inc: (parseFloat(inc) * Math.PI) / 180,
        raan: (parseFloat(raan) * Math.PI) / 180,
        n_rad_s: (parseFloat(mm) * 2 * Math.PI) / 86400,
        m0: Math.random() * 2 * Math.PI,
        kind: (kind || "sat").toLowerCase(),
        health: health ? parseFloat(health) : 100,
        battery: battery ? parseFloat(battery) : 100
      });
    }
    return out;
  }

  // Standard 3-line TLEs
  const out = [];
  for (let i = 0; i + 2 < lines.length; ) {
    const name = lines[i]; const l1 = lines[i+1]; const l2 = lines[i+2];
    if (l1?.startsWith("1 ") && l2?.startsWith("2 ")) { out.push({ name, l1, l2 }); i += 3; }
    else { i += 1; }
  }
  return out;
}

/* -------------------------- ECI/ECEF for synthetic -------------------------- */
const Rkm = 6371.0;
function Rz(a){ const c=Math.cos(a), s=Math.sin(a); return [[ c,-s,0],[ s, c,0],[0,0,1]]; }
function Rx(a){ const c=Math.cos(a), s=Math.sin(a); return [[1,0,0],[0,c,-s],[0,s,c]]; }
function mul3(A,v){ return [A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2], A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2], A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]]; }
function getECEFfromSynthetic(rec, date){
  const n = rec.n_rad_s; const M = rec.m0 + n * ((date.getTime())/1000);
  const x_orb = rec.a_km * Math.cos(M), y_orb = rec.a_km * Math.sin(M), z_orb = 0;
  let r = [x_orb, y_orb, z_orb];
  r = mul3(Rx(rec.inc), r);
  r = mul3(Rz(rec.raan), r);
  const gmst = window.satellite.gstime(date);
  r = mul3(Rz(gmst), r);
  return { x:r[0], y:r[1], z:r[2] };
}
function getECEF(rec, date){
  if (rec.mode === "synthetic") return getECEFfromSynthetic(rec, date);
  const pv = window.satellite.propagate(rec, date);
  if (!pv.position) return null;
  const gmst = window.satellite.gstime(date);
  return window.satellite.eciToEcf(pv.position, gmst);
}

/* ------------------------------- Component -------------------------------- */
export default function Globe3D({ onSelect, overlayType = "none", overlayDate }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const { state } = useApp();

  const [status, setStatus] = useState("Loading 3D…");
  const [banner, setBanner] = useState("");
  const [overlayInfo, setOverlayInfo] = useState(null);
  const [collisions, setCollisions] = useState([]);

  // hover billboard sprite
  const hoverSprite = useRef(null);
  const hoveredObj = useRef(null);

  // tracks UI
  const [tracksOn, setTracksOn] = useState(true);
  const [trackMinutes, setTrackMinutes] = useState(40);
  
  // collision detection
  const collisionCheckTimer = useRef(0);
  
  // selected satellite orbit (red)
  const selectedOrbitLine = useRef(null);
  
  // debris collection system
  const [selectedDebris, setSelectedDebris] = useState([]);
  const [selectedSatellites, setSelectedSatellites] = useState([]);
  const crawlerSatellite = useRef(null);
  const collectionPath = useRef(null);
  const satelliteCapturePath = useRef(null);
  const crawlerOrbitPath = useRef(null);
  const lastCalculationTime = useRef(0);

  useEffect(() => {
    let renderer, scene, camera, raf;
    let THREE;

    let earthGroup, baseMesh, overlayMesh;
    const satMeshes = [], debMeshes = [];
    const trackLines = [];

    let yaw = 0, pitch = 0, dragging = false, lastX = 0, lastY = 0;
    let destroyed = false;

    (async () => {
      try { ({ THREE } = await loadThreeAndSatellite()); }
      catch (e) { console.error(e); setStatus("Couldn’t load 3D libs."); return; }
      if (destroyed) return;

      renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, canvas: canvasRef.current });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
      if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

      scene = new THREE.Scene();
      scene.background = new THREE.Color("#06090f");

      camera = new THREE.PerspectiveCamera(55, wrapRef.current.clientWidth / wrapRef.current.clientHeight, 0.1, 200);
      camera.position.set(0, 0, 3.3);
      
      // Enhanced lighting for realism
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);
      
      const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
      sunLight.position.set(5, 3, 5);
      scene.add(sunLight);
      
      const fillLight = new THREE.DirectionalLight(0x4dd0e1, 0.3);
      fillLight.position.set(-5, -2, -5);
      scene.add(fillLight);
      
      const rimLight = new THREE.PointLight(0x00d4ff, 0.5, 10);
      rimLight.position.set(0, 0, 2);
      scene.add(rimLight);

      // Enhanced stars
      const starsCount = 4000, starsR = 80, pos = new Float32Array(starsCount*3);
      const starsSizes = new Float32Array(starsCount);
      const starsColors = new Float32Array(starsCount*3);
      
      for (let i=0;i<starsCount;i++){
        const u=Math.random(), v=Math.random();
        const th=2*Math.PI*u, ph=Math.acos(2*v-1);
        pos[3*i+0]=starsR*Math.sin(ph)*Math.cos(th);
        pos[3*i+1]=starsR*Math.sin(ph)*Math.sin(th);
        pos[3*i+2]=starsR*Math.cos(ph);
        
        // Varied star sizes
        starsSizes[i] = Math.random() * 0.15 + 0.08;
        
        // Slight color variation (white to blue-white)
        const colorVariation = 0.9 + Math.random() * 0.1;
        starsColors[3*i+0] = colorVariation;
        starsColors[3*i+1] = colorVariation;
        starsColors[3*i+2] = 1.0;
      }
      const starsGeo=new THREE.BufferGeometry();
      starsGeo.setAttribute("position", new THREE.BufferAttribute(pos,3));
      starsGeo.setAttribute("size", new THREE.BufferAttribute(starsSizes,1));
      starsGeo.setAttribute("color", new THREE.BufferAttribute(starsColors,3));
      
      const starsMat = new THREE.PointsMaterial({ 
        size:0.15, 
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9
      });
      scene.add(new THREE.Points(starsGeo, starsMat));

      earthGroup = new THREE.Group(); scene.add(earthGroup);
      
      // Enhanced Earth with better lighting
      baseMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1,128,128), 
        new THREE.MeshStandardMaterial({ 
          color:0x1f2a44,
          roughness: 0.8,
          metalness: 0.1
        })
      );
      earthGroup.add(baseMesh);
      
      // Add subtle atmosphere glow
      const atmosphereGeo = new THREE.SphereGeometry(1.01, 64, 64);
      const atmosphereMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide
      });
      const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
      earthGroup.add(atmosphere);

      const dateStr = overlayDate || new Date().toISOString().slice(0,10);
      (async () => {
        const base = await progressiveGibsTexture(THREE, BASE_LAYERS, dateStr, { transparent:false });
        if (!base) setBanner("Base imagery unavailable (network).");
        else {
          baseMesh.material.dispose();
          baseMesh.material = new THREE.MeshBasicMaterial({ map: base.texture });
          setBanner(base.layer === "BlueMarble_Fallback" ? "Using NASA Blue Marble fallback." : "");
        }
      })();

      async function setOverlay(type, date) {
        if (overlayMesh) {
          earthGroup.remove(overlayMesh);
          overlayMesh.geometry.dispose();
          overlayMesh.material.dispose();
          overlayMesh=null;
        }
        setOverlayInfo(null);
        if (type==="none") return;

        const layers = type==="atmoRivers" ? AR_LAYERS : EN_LAYERS;
        const res = await progressiveGibsTexture(THREE,layers,date,{transparent:true});
        if (!res || res.layer==="BlueMarble_Fallback") { setBanner("Overlay unavailable. Base imagery shown."); return; }
        overlayMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1.002,128,128),
          new THREE.MeshBasicMaterial({ map: res.texture, transparent:true, opacity:.78, depthWrite:false })
        );
        earthGroup.add(overlayMesh);
        setOverlayInfo({layer:res.layer}); setBanner("");
      }
      setOverlay(overlayType, dateStr);

      // controls
      const dom = renderer.domElement;
      const onDown = e => { dragging=true; lastX=e.clientX; lastY=e.clientY; };
      const onMove = e => { if(!dragging) return; const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY; yaw -= dx*0.005; pitch=Math.max(-1.3,Math.min(1.3,pitch-dy*0.005)); };
      const onUp = () => { dragging=false; };
      dom.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);

      const onResize = () => { const w=wrapRef.current.clientWidth, h=wrapRef.current.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
      window.addEventListener("resize", onResize); onResize();

      /* ---------------------- hover billboard sprite ---------------------- */
      const makeLabelSprite = (text) => {
        const c = document.createElement("canvas");
        c.width = 1024; c.height = 512;
        const ctx = c.getContext("2d");
        const draw = (t) => {
          ctx.clearRect(0,0,c.width,c.height);
          // panel
          ctx.fillStyle = "rgba(9,12,18,0.85)";
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.lineWidth = 8;
          const r = 48;
          ctx.beginPath();
          ctx.moveTo(r,0); ctx.lineTo(c.width-r,0); ctx.quadraticCurveTo(c.width,0,c.width,r);
          ctx.lineTo(c.width,c.height-r); ctx.quadraticCurveTo(c.width,c.height,c.width-r,c.height);
          ctx.lineTo(r,c.height); ctx.quadraticCurveTo(0,c.height,0,c.height-r);
          ctx.lineTo(0,r); ctx.quadraticCurveTo(0,0,r,0); ctx.closePath();
          ctx.fill(); ctx.stroke();

          // text
          ctx.fillStyle = "#e5f1ff";
          ctx.font = "bold 80px ui-sans-serif, system-ui, -apple-system, Segoe UI";
          const lines = t.split("\n");
          let y = 120;
          for (const ln of lines) { ctx.fillText(ln, 60, y); y += 90; }
        };
        draw(text);
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, depthWrite:false, transparent:true });
        const spr = new THREE.Sprite(mat);
        spr.scale.set(2.2, 1.1, 1); // world units; we’ll rescale per distance
        spr.userData._canvas = c;
        spr.userData._draw = draw;
        spr.userData._tex = tex;
        return spr;
      };
      hoverSprite.current = makeLabelSprite("…");
      hoverSprite.current.visible = false;
      scene.add(hoverSprite.current);

      function updateLabel(text, anchor, cam) {
        const spr = hoverSprite.current;
        if (!spr) return;
        spr.userData._draw(text);
        spr.userData._tex.needsUpdate = true;
        // position slightly off the marker
        spr.position.copy(anchor.clone().multiplyScalar(1.08));
        spr.lookAt(cam.position);
        // keep (roughly) constant on-screen size
        const dist = spr.position.distanceTo(cam.position);
        const k = Math.max(1.3, Math.min(3.6, dist * 0.45));
        spr.scale.set(k, k*0.5, 1);
        spr.visible = true;
      }

      /* ----------------------- TLE & synthetic loading ---------------------- */
      function clearSatMeshes() {
        for (const m of [...satMeshes, ...debMeshes]) {
          scene.remove(m);
          m.geometry.dispose();
          // material is shared; don't dispose
        }
        satMeshes.length = 0; debMeshes.length = 0;
      }
      function clearTracks() {
        for (const ln of trackLines) {
          scene.remove(ln);
          ln.geometry.dispose();
          ln.material.dispose();
        }
        trackLines.length = 0;
      }

      const debMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff7b72") });

      function buildFromList(list) {
        clearTracks();
        clearSatMeshes();
        if (!list?.length) return;

        const act = list.filter(o => (o.kind||"sat")!=="debris").slice(0,160);
        const deb = list.filter(o => (o.kind||"sat")==="debris").slice(0,60);

        for (const t of act) {
          const rec = t.mode==="synthetic" ? t : window.satellite.twoline2satrec(t.l1, t.l2);
          
          // Determine altitude for lifecycle calculation
          let altKm = 500; // default
          if (t.mode === "synthetic") {
            altKm = t.a_km - 6371;
          } else if (rec.a) {
            altKm = (rec.a * 6371) - 6371; // Convert semi-major axis to altitude
          }
          
          // Calculate lifecycle stage and get color
          const lifecycle = calculateLifecycle(altKm, 0, state?.drag ?? 1.0);
          const color = getLifecycleColor(lifecycle);
          
          // Enhanced satellite visualization with group
          const satGroup = new THREE.Group();
          
          // Main satellite body - BIGGER SIZE for better visibility
          const satMat = new THREE.MeshStandardMaterial({ 
            color: hexToNumber(color),
            emissive: hexToNumber(color),
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.7
          });
          const mainBody = new THREE.Mesh(new THREE.SphereGeometry(0.022,20,20), satMat); // Increased from 0.014
          satGroup.add(mainBody);
          
          // Add a subtle glow ring for better visibility
          const glowMat = new THREE.MeshBasicMaterial({
            color: hexToNumber(color),
            transparent: true,
            opacity: 0.35,
            side: THREE.BackSide
          });
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.028,20,20), glowMat); // Increased from 0.018
          satGroup.add(glow);
          
          satGroup.userData = { 
            name: t.name, 
            kind:"sat", 
            rec, 
            lifecycle, 
            altKm,
            health: t.health || 100,
            battery: t.battery || 100
          };
          scene.add(satGroup); 
          satMeshes.push(satGroup);
        }
        for (const t of deb) {
          const rec = t.mode==="synthetic" ? t : window.satellite.twoline2satrec(t.l1, t.l2);
          
          // Enhanced debris visualization with group (BIGGER SIZE + BLOOD RED)
          const debrisGroup = new THREE.Group();
          
          // Main debris body - larger for better visibility with BLOOD RED color
          const debrisMat = new THREE.MeshStandardMaterial({
            color: 0x8B0000, // Dark blood red
            emissive: 0xff0000, // Bright red emissive
            emissiveIntensity: 0.5,
            roughness: 0.6,
            metalness: 0.5
          });
          const mainDebris = new THREE.Mesh(new THREE.SphereGeometry(0.016,16,16), debrisMat); // Increased from 0.009
          debrisGroup.add(mainDebris);
          
          // Add warning glow for visibility (proportionally larger) - BLOOD RED
          const warningGlow = new THREE.MeshBasicMaterial({
            color: 0xDC143C, // Crimson red
            transparent: true,
            opacity: 0.4,
            side: THREE.BackSide
          });
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.021,16,16), warningGlow); // Increased from 0.012
          debrisGroup.add(glow);
          
          debrisGroup.userData = { name: t.name, kind:"debris", rec };
          scene.add(debrisGroup); 
          debMeshes.push(debrisGroup);
        }
      }

      async function loadOffline() {
        try {
          const txt = await fetchText("/tle/custom.tle");
          const list = parseTLEText(txt);
          buildFromList(list);
          setBanner(`Loaded ${list.length} objects (custom.tle)`);
          return true;
        } catch {
          // nothing offline
          return false;
        }
      }

      await loadOffline(); // prefer your offline file always

      /* ------------------------------ Crawler Satellite ------------------------------ */
      // Create the DARKER BLUE crawler satellite with PURPLE DUST - CYLINDRICAL SHAPE
      function createCrawlerSatellite() {
        const crawlerGroup = new THREE.Group();
        
        // Main body - CYLINDRICAL with DARKER NEON BLUE
        const crawlerMat = new THREE.MeshStandardMaterial({
          color: 0x0066cc, // Darker neon blue
          emissive: 0x0066cc,
          emissiveIntensity: 0.7, // Less bright
          roughness: 0.15,
          metalness: 0.9
        });
        // Cylinder: radius, height, radialSegments
        const mainBody = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.06, 16), crawlerMat);
        mainBody.rotation.x = Math.PI / 2; // Orient horizontally
        crawlerGroup.add(mainBody);
        
        // End caps with darker blue color for detail
        const capMat = new THREE.MeshStandardMaterial({
          color: 0x004499,
          emissive: 0x0066aa,
          emissiveIntensity: 0.5,
          roughness: 0.25,
          metalness: 0.85
        });
        const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 16), capMat);
        cap1.rotation.x = Math.PI / 2;
        cap1.position.z = 0.03;
        crawlerGroup.add(cap1);
        
        const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 16), capMat);
        cap2.rotation.x = Math.PI / 2;
        cap2.position.z = -0.03;
        crawlerGroup.add(cap2);
        
        // Solar panels (wings) - darker blue
        const panelMat = new THREE.MeshStandardMaterial({
          color: 0x000a22,
          emissive: 0x003366,
          emissiveIntensity: 0.2,
          roughness: 0.5,
          metalness: 0.75
        });
        const panel1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, 0.04), panelMat);
        panel1.position.x = 0.04;
        crawlerGroup.add(panel1);
        
        const panel2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, 0.04), panelMat);
        panel2.position.x = -0.04;
        crawlerGroup.add(panel2);
        
        // DARKER BLUE inner glow around the structure
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0x0066cc,
          transparent: true,
          opacity: 0.4,
          side: THREE.BackSide
        });
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.050, 20, 20), glowMat);
        crawlerGroup.add(glow);
        
        // PURPLE outer glow/dust spreading effect
        const purpleDustMat = new THREE.MeshBasicMaterial({
          color: 0x9966ff, // Purple color
          transparent: true,
          opacity: 0.35,
          side: THREE.BackSide
        });
        const purpleDust = new THREE.Mesh(new THREE.SphereGeometry(0.070, 24, 24), purpleDustMat);
        crawlerGroup.add(purpleDust);
        
        // Additional purple particles/dust layer
        const purpleParticlesMat = new THREE.MeshBasicMaterial({
          color: 0xaa44ff, // Bright purple
          transparent: true,
          opacity: 0.25,
          side: THREE.BackSide
        });
        const purpleParticles = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 20), purpleParticlesMat);
        crawlerGroup.add(purpleParticles);
        
        crawlerGroup.userData = {
          name: "Debris Crawler",
          kind: "crawler",
          isCrawler: true
        };
        
        // Start at proper orbital altitude (same as satellites)
        const crawlerRadius = 1.08; // LEO altitude
        crawlerGroup.position.set(crawlerRadius, 0, 0);
        
        // IMPORTANT: Mark it as always visible (fixes disappearing bug)
        crawlerGroup.frustumCulled = false;
        crawlerGroup.renderOrder = 999; // Render on top
        
        scene.add(crawlerGroup);
        crawlerSatellite.current = crawlerGroup;
        
        return crawlerGroup;
      }
      
      createCrawlerSatellite(); // Add the crawler to the scene

      /* ------------------------------ Pathfinding Algorithm ------------------------------ */
      // Calculate distance between two 3D points
      function distance3D(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      
      // Nearest neighbor algorithm for TSP (Traveling Salesman Problem)
      function findShortestPath(startPos, debrisPositions) {
        if (debrisPositions.length === 0) return [];
        if (debrisPositions.length === 1) return [0];
        
        const visited = new Set();
        const path = [];
        let currentPos = startPos;
        
        while (visited.size < debrisPositions.length) {
          let nearestIdx = -1;
          let nearestDist = Infinity;
          
          for (let i = 0; i < debrisPositions.length; i++) {
            if (visited.has(i)) continue;
            const dist = distance3D(currentPos, debrisPositions[i]);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIdx = i;
            }
          }
          
          if (nearestIdx !== -1) {
            visited.add(nearestIdx);
            path.push(nearestIdx);
            currentPos = debrisPositions[nearestIdx];
          }
        }
        
        return path;
      }
      
      // Calculate total distance for a given path order
      function calculatePathDistance(startPos, debrisPositions, pathOrder) {
        let totalDistance = 0;
        let currentPos = startPos;
        
        for (const idx of pathOrder) {
          const dist = distance3D(currentPos, debrisPositions[idx]);
          totalDistance += dist;
          currentPos = debrisPositions[idx];
        }
        
        return totalDistance;
      }
      
      // Generate all possible permutations (for small sets)
      function generateAllPermutations(arr) {
        if (arr.length <= 1) return [arr];
        
        const result = [];
        for (let i = 0; i < arr.length; i++) {
          const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
          const perms = generateAllPermutations(rest);
          for (const perm of perms) {
            result.push([arr[i], ...perm]);
          }
        }
        return result;
      }
      
      // Find truly optimal path (brute force for small sets)
      function findOptimalPath(startPos, debrisPositions) {
        if (debrisPositions.length === 0) return [];
        if (debrisPositions.length === 1) return [0];
        if (debrisPositions.length > 6) {
          // Too many permutations, use nearest neighbor
          return findShortestPath(startPos, debrisPositions);
        }
        
        const indices = Array.from({ length: debrisPositions.length }, (_, i) => i);
        const allPermutations = generateAllPermutations(indices);
        
        let bestPath = null;
        let bestDistance = Infinity;
        
        for (const perm of allPermutations) {
          const distance = calculatePathDistance(startPos, debrisPositions, perm);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPath = perm;
          }
        }
        
        return bestPath;
      }
      
      // Draw the collection path with debugging info
      function drawCollectionPath(debrisList) {
        // Clear previous path
        if (collectionPath.current) {
          scene.remove(collectionPath.current);
          collectionPath.current.geometry.dispose();
          collectionPath.current.material.dispose();
          collectionPath.current = null;
        }
        
        if (debrisList.length === 0) return;
        
        // Get positions of selected debris
        const debrisPositions = debrisList.map(d => d.position.clone());
        
        // Find shortest path starting from crawler position
        const crawlerPos = crawlerSatellite.current.position.clone();
        const pathOrder = findShortestPath(crawlerPos, debrisPositions);
        
        // Calculate total distance for verification
        let totalDistance = 0;
        let currentPos = crawlerPos;
        
        console.log("=== PATHFINDING DEBUG ===");
        console.log(`Crawler position: (${crawlerPos.x.toFixed(3)}, ${crawlerPos.y.toFixed(3)}, ${crawlerPos.z.toFixed(3)})`);
        console.log(`Selected ${debrisList.length} debris pieces`);
        console.log("Nearest Neighbor Algorithm Result:");
        
        for (let i = 0; i < pathOrder.length; i++) {
          const idx = pathOrder[i];
          const debrisPos = debrisPositions[idx];
          const dist = distance3D(currentPos, debrisPos);
          totalDistance += dist;
          
          console.log(`  ${i + 1}. ${debrisList[idx].userData.name} - Distance: ${dist.toFixed(3)}`);
          console.log(`     Position: (${debrisPos.x.toFixed(3)}, ${debrisPos.y.toFixed(3)}, ${debrisPos.z.toFixed(3)})`);
          
          currentPos = debrisPos;
        }
        
        console.log(`Nearest Neighbor Total Distance: ${totalDistance.toFixed(3)}`);
        
        // Compare with optimal solution (for small sets)
        if (debrisList.length <= 6) {
          const optimalPath = findOptimalPath(crawlerPos, debrisPositions);
          const optimalDistance = calculatePathDistance(crawlerPos, debrisPositions, optimalPath);
          
          console.log("Optimal Solution Comparison:");
          console.log(`Optimal Total Distance: ${optimalDistance.toFixed(3)}`);
          console.log(`Nearest Neighbor Distance: ${totalDistance.toFixed(3)}`);
          console.log(`Difference: ${(totalDistance - optimalDistance).toFixed(3)}`);
          console.log(`Accuracy: ${((optimalDistance / totalDistance) * 100).toFixed(1)}%`);
          
          if (Math.abs(totalDistance - optimalDistance) < 0.001) {
            console.log("✅ Nearest Neighbor found the OPTIMAL solution!");
          } else {
            console.log("⚠️ Nearest Neighbor is suboptimal (but still very good)");
          }
        } else {
          console.log("Too many debris for optimal comparison (using nearest neighbor)");
        }
        
        console.log("========================");
        
        // Build the line path: crawler -> debris1 -> debris2 -> ...
        const points = [crawlerPos];
        for (const idx of pathOrder) {
          points.push(debrisPositions[idx].clone());
        }
        
        // Create the path line
        const pathGeo = new THREE.BufferGeometry().setFromPoints(points);
        const pathMat = new THREE.LineBasicMaterial({
          color: 0xff0000,
          linewidth: 3,
          transparent: true,
          opacity: 0.9
        });
        
        const pathLine = new THREE.Line(pathGeo, pathMat);
        scene.add(pathLine);
        collectionPath.current = pathLine;
        
        // Add distance markers for verification
        addDistanceMarkers(points, totalDistance);
      }
      
      // Add visual distance markers to verify path
      function addDistanceMarkers(points, totalDistance) {
        // Clear previous markers
        const existingMarkers = scene.children.filter(child => child.userData?.isDistanceMarker);
        existingMarkers.forEach(marker => {
          scene.remove(marker);
          marker.geometry.dispose();
          marker.material.dispose();
        });
        
        // Add markers at each point
        points.forEach((point, index) => {
          const markerGeo = new THREE.SphereGeometry(0.008, 8, 8);
          const markerMat = new THREE.MeshBasicMaterial({
            color: index === 0 ? 0x00ff9f : 0xff0000, // Green for start, red for debris
            emissive: index === 0 ? 0x00ff9f : 0xff0000,
            emissiveIntensity: 0.5
          });
          
          const marker = new THREE.Mesh(markerGeo, markerMat);
          marker.position.copy(point);
          marker.userData = { isDistanceMarker: true };
          scene.add(marker);
          
          // Add text label for debugging
          if (index > 0) {
            const textGeo = new THREE.PlaneGeometry(0.05, 0.02);
            const textMat = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.8
            });
            const textMesh = new THREE.Mesh(textGeo, textMat);
            textMesh.position.copy(point);
            textMesh.position.y += 0.02;
            textMesh.userData = { isDistanceMarker: true };
            scene.add(textMesh);
          }
        });
        
        // Add comprehensive path analysis display
        const analysisText = document.createElement('div');
        analysisText.style.cssText = `
          position: absolute;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.9);
          color: #00ff9f;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 11px;
          z-index: 1000;
          border: 1px solid #00ff9f;
          max-width: 300px;
          line-height: 1.4;
        `;
        
        let analysisContent = `🤖 PATHFINDING ANALYSIS\n`;
        analysisContent += `Selected: ${points.length - 1} debris\n`;
        analysisContent += `Total Distance: ${totalDistance.toFixed(3)}\n`;
        
        // Add optimal comparison if available
        if (points.length - 1 <= 6) {
          const crawlerPos = points[0];
          const debrisPositions = points.slice(1);
          const optimalPath = findOptimalPath(crawlerPos, debrisPositions);
          const optimalDistance = calculatePathDistance(crawlerPos, debrisPositions, optimalPath);
          const accuracy = ((optimalDistance / totalDistance) * 100).toFixed(1);
          
          analysisContent += `Optimal Distance: ${optimalDistance.toFixed(3)}\n`;
          analysisContent += `Algorithm Accuracy: ${accuracy}%\n`;
          
          if (Math.abs(totalDistance - optimalDistance) < 0.001) {
            analysisContent += `✅ OPTIMAL SOLUTION!\n`;
          } else {
            analysisContent += `⚠️ Suboptimal (but efficient)\n`;
          }
        } else {
          analysisContent += `Using Nearest Neighbor\n`;
          analysisContent += `(Too many for optimal)\n`;
        }
        
        analysisContent += `\n💡 Check console for details`;
        
        analysisText.textContent = analysisContent;
        analysisText.id = 'path-analysis-display';
        
        // Remove existing display
        const existing = document.getElementById('path-analysis-display');
        if (existing) existing.remove();
        
        document.body.appendChild(analysisText);
      }
      
      // Optimized orbital intercept calculation with caching and error handling
      const interceptCache = new Map();
      
      function calculateOrbitalIntercept(satelliteList, timeRangeHours = 12) {
        if (satelliteList.length < 2) return null;
        
        // Create cache key based on satellite IDs and time range
        const cacheKey = satelliteList.map(s => s.userData.name).sort().join(',') + `_${timeRangeHours}`;
        
        // Check cache first
        if (interceptCache.has(cacheKey)) {
          const cached = interceptCache.get(cacheKey);
          if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
            console.log("Using cached intercept calculation");
            return cached.data;
          }
        }
        
        const startTime = new Date();
        const stepMinutes = 60; // Reduced to 1 hour steps for better performance
        const steps = Math.min(Math.floor((timeRangeHours * 60) / stepMinutes), 24); // Max 24 steps
        
        let bestTime = startTime;
        let minTotalDistance = Infinity;
        let interceptPositions = [];
        let validCalculations = 0;
        
        console.log("=== OPTIMIZED ORBITAL INTERCEPT ===");
        console.log(`Analyzing ${satelliteList.length} satellites over ${timeRangeHours} hours`);
        console.log(`Checking every ${stepMinutes} minutes (${steps} steps)`);
        
        try {
          for (let i = 0; i <= steps; i++) {
            const checkTime = new Date(startTime.getTime() + i * stepMinutes * 60 * 1000);
            const positions = [];
            let validPositions = 0;
            
            // Get positions of all satellites at this time with error handling
            for (const sat of satelliteList) {
              try {
                const ecef = getECEF(sat.userData.rec, checkTime);
                if (ecef && !isNaN(ecef.x) && !isNaN(ecef.y) && !isNaN(ecef.z)) {
                  const pos = {
                    x: ecef.x / Rkm,
                    y: ecef.y / Rkm,
                    z: ecef.z / Rkm
                  };
                  
                  // Validate position
                  if (pos.x !== 0 || pos.y !== 0 || pos.z !== 0) {
                    positions.push(pos);
                    validPositions++;
                  }
                }
              } catch (error) {
                console.warn(`Error calculating position for ${sat.userData.name}:`, error);
              }
            }
            
            if (validPositions === satelliteList.length) {
              // Calculate total distance between all satellites
              let totalDistance = 0;
              for (let j = 0; j < positions.length; j++) {
                for (let k = j + 1; k < positions.length; k++) {
                  const dist = distance3D(positions[j], positions[k]);
                  if (!isNaN(dist) && dist > 0) {
                    totalDistance += dist;
                  }
                }
              }
              
              if (totalDistance < minTotalDistance && totalDistance > 0) {
                minTotalDistance = totalDistance;
                bestTime = checkTime;
                interceptPositions = [...positions]; // Deep copy
                validCalculations++;
              }
            }
          }
          
          // Only proceed if we have valid calculations
          if (validCalculations === 0 || interceptPositions.length === 0) {
            console.warn("No valid intercept calculations found");
            return null;
          }
          
          // Calculate centroid (average position) of satellites at best time
          const centroid = {
            x: interceptPositions.reduce((sum, pos) => sum + pos.x, 0) / interceptPositions.length,
            y: interceptPositions.reduce((sum, pos) => sum + pos.y, 0) / interceptPositions.length,
            z: interceptPositions.reduce((sum, pos) => sum + pos.z, 0) / interceptPositions.length
          };
          
          // Validate centroid
          if (isNaN(centroid.x) || isNaN(centroid.y) || isNaN(centroid.z)) {
            console.warn("Invalid centroid calculated");
            return null;
          }
          
          const result = {
            time: bestTime,
            centroid: centroid,
            positions: interceptPositions,
            totalDistance: minTotalDistance
          };
          
          // Cache the result
          interceptCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
          
          // Limit cache size
          if (interceptCache.size > 10) {
            const firstKey = interceptCache.keys().next().value;
            interceptCache.delete(firstKey);
          }
          
          console.log(`Best intercept time: ${bestTime.toISOString()}`);
          console.log(`Time from now: ${Math.round((bestTime.getTime() - startTime.getTime()) / (60 * 1000))} minutes`);
          console.log(`Min total distance: ${minTotalDistance.toFixed(3)}`);
          console.log(`Intercept centroid: (${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)})`);
          console.log(`Valid calculations: ${validCalculations}`);
          console.log("=====================================");
          
          return result;
          
        } catch (error) {
          console.error("Error in orbital intercept calculation:", error);
          return null;
        }
      }
      
      // Optimized crawler orbital path calculation with error handling
      function calculateCrawlerOrbitPath(interceptData) {
        if (!interceptData || !interceptData.centroid) return null;
        
        try {
          const crawlerPos = crawlerSatellite.current.position.clone();
          const interceptPos = interceptData.centroid;
          
          // Validate positions
          if (!crawlerPos || !interceptPos || 
              isNaN(crawlerPos.x) || isNaN(interceptPos.x)) {
            console.warn("Invalid positions for crawler orbit calculation");
            return null;
          }
          
          // Calculate orbital transfer with optimized steps
          const timeToIntercept = Math.max((interceptData.time.getTime() - Date.now()) / 1000, 0); // seconds
          const steps = Math.min(Math.max(Math.floor(timeToIntercept / 60), 10), 50); // 10-50 steps based on time
          const stepTime = timeToIntercept / steps;
          
          const orbitPoints = [];
          const targetRadius = 1.12; // Crawler's orbital altitude
          
          // Generate orbital path points with error handling
          for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            
            // Smooth interpolation with easing
            const easedProgress = progress * progress * (3 - 2 * progress); // Smooth step function
            
            // Interpolate between current crawler position and intercept point
            const currentPos = {
              x: crawlerPos.x + (interceptPos.x - crawlerPos.x) * easedProgress,
              y: crawlerPos.y + (interceptPos.y - crawlerPos.y) * easedProgress,
              z: crawlerPos.z + (interceptPos.z - crawlerPos.z) * easedProgress
            };
            
            // Normalize to orbital radius (maintain altitude)
            const radius = Math.sqrt(currentPos.x * currentPos.x + currentPos.y * currentPos.y + currentPos.z * currentPos.z);
            
            if (radius > 0) {
              currentPos.x = (currentPos.x / radius) * targetRadius;
              currentPos.y = (currentPos.y / radius) * targetRadius;
              currentPos.z = (currentPos.z / radius) * targetRadius;
              
              // Validate final position
              if (!isNaN(currentPos.x) && !isNaN(currentPos.y) && !isNaN(currentPos.z)) {
                orbitPoints.push(new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z));
              }
            }
          }
          
          // Ensure we have valid points
          if (orbitPoints.length < 2) {
            console.warn("Insufficient orbit points generated");
            return null;
          }
          
          return orbitPoints;
          
        } catch (error) {
          console.error("Error calculating crawler orbit path:", error);
          return null;
        }
      }
      
      // Optimized crawler orbital path drawing with memory management
      function drawCrawlerOrbitPath(orbitPoints) {
        try {
          // Clear previous crawler orbit path safely
          if (crawlerOrbitPath.current) {
            scene.remove(crawlerOrbitPath.current);
            if (crawlerOrbitPath.current.geometry) {
              crawlerOrbitPath.current.geometry.dispose();
            }
            if (crawlerOrbitPath.current.material) {
              crawlerOrbitPath.current.material.dispose();
            }
            crawlerOrbitPath.current = null;
          }
          
          if (!orbitPoints || orbitPoints.length < 2) {
            console.log("No valid orbit points to draw");
            return;
          }
          
          // Validate orbit points
          const validPoints = orbitPoints.filter(point => 
            point && !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
          );
          
          if (validPoints.length < 2) {
            console.warn("Insufficient valid orbit points");
            return;
          }
          
          // Create the crawler orbit path line (red) with optimized geometry
          const pathGeo = new THREE.BufferGeometry().setFromPoints(validPoints);
          const pathMat = new THREE.LineBasicMaterial({
            color: 0xff0000, // Red color for crawler orbit
            linewidth: 3, // Reduced linewidth for better performance
            transparent: true,
            opacity: 0.8
          });
          
          const pathLine = new THREE.Line(pathGeo, pathMat);
          pathLine.userData = { type: 'crawlerOrbit' }; // For easy identification
          scene.add(pathLine);
          crawlerOrbitPath.current = pathLine;
          
          console.log("=== OPTIMIZED CRAWLER ORBIT ===");
          console.log(`Generated ${validPoints.length} orbital points`);
          console.log(`Filtered ${orbitPoints.length - validPoints.length} invalid points`);
          console.log("=================================");
          
        } catch (error) {
          console.error("Error drawing crawler orbit path:", error);
        }
      }
      
      // Draw satellite capture path
      function drawSatelliteCapturePath(satelliteList) {
        // Clear previous satellite capture path
        if (satelliteCapturePath.current) {
          scene.remove(satelliteCapturePath.current);
          satelliteCapturePath.current.geometry.dispose();
          satelliteCapturePath.current.material.dispose();
          satelliteCapturePath.current = null;
        }
        
        if (satelliteList.length === 0) return;
        
        // Get positions of selected satellites
        const satellitePositions = satelliteList.map(s => s.position.clone());
        
        // Optimized orbital intercept calculation with throttling
        let interceptData = null;
        let points = [];
        
        try {
          // Only calculate intercept for 2+ satellites
          if (satelliteList.length >= 2) {
            interceptData = calculateOrbitalIntercept(satelliteList);
          }
          
          if (interceptData && interceptData.positions && interceptData.positions.length > 0) {
            // Calculate crawler orbital path to intercept point
            const crawlerOrbitPoints = calculateCrawlerOrbitPath(interceptData);
            if (crawlerOrbitPoints && crawlerOrbitPoints.length > 0) {
              drawCrawlerOrbitPath(crawlerOrbitPoints);
            }
            
            // Build the capture path using intercept positions
            points = interceptData.positions.map(pos => 
              new THREE.Vector3(pos.x, pos.y, pos.z)
            ).filter(point => 
              point && !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
            );
            
            console.log("=== OPTIMIZED SATELLITE CAPTURE ===");
            console.log(`Intercept time: ${interceptData.time.toISOString()}`);
            console.log(`Time to intercept: ${Math.round((interceptData.time.getTime() - Date.now()) / (60 * 1000))} minutes`);
            console.log(`Intercept centroid: (${interceptData.centroid.x.toFixed(3)}, ${interceptData.centroid.y.toFixed(3)}, ${interceptData.centroid.z.toFixed(3)})`);
            console.log(`Satellites will be ${interceptData.totalDistance.toFixed(3)} units apart`);
            console.log("===================================");
          } else {
            // Fallback to simple pathfinding if intercept calculation fails
            const crawlerPos = crawlerSatellite.current.position.clone();
            const pathOrder = findShortestPath(crawlerPos, satellitePositions);
            
            points = [crawlerPos];
            for (const idx of pathOrder) {
              if (satellitePositions[idx]) {
                points.push(satellitePositions[idx].clone());
              }
            }
            
            console.log("=== FALLBACK SATELLITE CAPTURE ===");
            console.log("Using simple pathfinding (intercept calculation failed)");
            console.log("=================================");
          }
        } catch (error) {
          console.error("Error in satellite capture path calculation:", error);
          // Emergency fallback
          points = satellitePositions.slice(0, 3); // Limit to first 3 satellites
        }
        
        // Create the satellite capture path line (green)
        const pathGeo = new THREE.BufferGeometry().setFromPoints(points);
        const pathMat = new THREE.LineBasicMaterial({
          color: 0x00ff9f, // Green color for satellite capture
          linewidth: 3,
          transparent: true,
          opacity: 0.9
        });
        
        const pathLine = new THREE.Line(pathGeo, pathMat);
        scene.add(pathLine);
        satelliteCapturePath.current = pathLine;
        
        // Add satellite capture analysis display
        const captureAnalysisText = document.createElement('div');
        captureAnalysisText.style.cssText = `
          position: absolute;
          bottom: 10px;
          right: 320px;
          background: rgba(0, 0, 0, 0.9);
          color: #00ff9f;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 11px;
          z-index: 1000;
          border: 1px solid #00ff9f;
          max-width: 300px;
          line-height: 1.4;
        `;
        
        let captureContent = `🛰️ SATELLITE CAPTURE\n`;
        captureContent += `Selected: ${points.length} satellites\n`;
        
        if (interceptData) {
          const timeToIntercept = Math.round((interceptData.time.getTime() - Date.now()) / (60 * 1000));
          captureContent += `Intercept Time: ${timeToIntercept} min\n`;
          captureContent += `Closest Distance: ${interceptData.totalDistance.toFixed(3)}\n`;
          captureContent += `Mission Type: Orbital Intercept\n`;
          captureContent += `\n🔴 Red line = Crawler orbit path\n`;
          captureContent += `🟢 Green line = Satellite positions\n`;
        } else {
          captureContent += `Mission Type: Direct Capture\n`;
          captureContent += `\n💡 Click satellites to plan intercept`;
        }
        
        captureAnalysisText.textContent = captureContent;
        captureAnalysisText.id = 'satellite-capture-display';
        
        // Remove existing display
        const existingCapture = document.getElementById('satellite-capture-display');
        if (existingCapture) existingCapture.remove();
        
        document.body.appendChild(captureAnalysisText);
      }

      /* ------------------------------ picking ------------------------------ */
      const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
      dom.addEventListener("mousemove", (e)=>{
        const r=dom.getBoundingClientRect();
        mouse.x=((e.clientX-r.left)/r.width)*2 -1;
        mouse.y= -((e.clientY-r.top)/r.height)*2 +1;
        ray.setFromCamera(mouse,camera);
        
        // Raycast with recursive=true to check children of groups
        const hits=ray.intersectObjects([...satMeshes,...debMeshes], true);
        if(hits.length){
          // Get the parent group, not the child mesh
          let obj = hits[0].object;
          while (obj.parent && !obj.userData.rec) {
            obj = obj.parent;
          }
          
          hoveredObj.current = obj;
          const info = computeSatInfo(obj.userData.rec, obj.userData.name, new Date());
          
          // Build tooltip text
          const lines = [
            `${obj.userData.kind === "debris" ? "💥" : "🛰️"} ${shortName(info.name)}`,
            `alt: ${isNaN(info.alt_km)? "—" : info.alt_km+" km"}   i: ${fmt(info.inc_deg)}°`,
            `Ω: ${fmt(info.raan_deg)}°   λ: ${fmt(info.lon_deg)}°`,
            `φ: ${fmt(info.lat_deg)}°`
          ];
          
          // Add health and battery for satellites
          if (obj.userData.kind === "sat" && obj.userData.health !== undefined) {
            const healthIcon = obj.userData.health > 80 ? "✓" : obj.userData.health > 50 ? "⚠" : "✗";
            const batteryIcon = obj.userData.battery > 70 ? "🔋" : obj.userData.battery > 30 ? "🪫" : "⚠️";
            lines.push(`${healthIcon} Health: ${obj.userData.health}%   ${batteryIcon} Battery: ${obj.userData.battery}%`);
          }
          
          const txt = lines.join("\n");
          updateLabel(txt, obj.position, camera);
        } else {
          if (hoverSprite.current) hoverSprite.current.visible = false;
          hoveredObj.current = null;
        }
      });

      dom.addEventListener("click", ()=>{
        if (!hoveredObj.current) return;
        const obj = hoveredObj.current;
        
        // Handle debris selection for pathfinding
        if (obj.userData.kind === "debris") {
          // Toggle selection
          const idx = selectedDebris.findIndex(d => d === obj);
          if (idx >= 0) {
            // Deselect - restore red color
            selectedDebris.splice(idx, 1);
            const mainMesh = obj.children[0];
            if (mainMesh && mainMesh.material) {
              mainMesh.material.color.set(0xff4757);
              mainMesh.material.emissive.set(0xff4757);
            }
            const glowMesh = obj.children[1];
            if (glowMesh && glowMesh.material) {
              glowMesh.material.color.set(0xff0000);
            }
          } else {
            // Select - change to indigo color
            selectedDebris.push(obj);
            const mainMesh = obj.children[0];
            if (mainMesh && mainMesh.material) {
              mainMesh.material.color.set(0x6366f1); // Indigo
              mainMesh.material.emissive.set(0x6366f1);
            }
            const glowMesh = obj.children[1];
            if (glowMesh && glowMesh.material) {
              glowMesh.material.color.set(0x6366f1); // Indigo
            }
          }
          
          // Redraw path with updated selection
          drawCollectionPath(selectedDebris);
          
          console.log(`Selected ${selectedDebris.length} debris for collection`);
        }
        // Handle satellite selection (show orbit + add to capture list) with throttling
        else if (obj.userData.kind === "sat") {
          const now = Date.now();
          
          // Throttle calculations to prevent glitches
          if (now - lastCalculationTime.current < 500) { // 500ms throttle
            console.log("Throttling satellite selection to prevent glitches");
            return;
          }
          lastCalculationTime.current = now;
          
          try {
            // Toggle satellite selection for capture
            const idx = selectedSatellites.findIndex(s => s === obj);
            if (idx >= 0) {
              // Deselect - remove from capture list
              selectedSatellites.splice(idx, 1);
              console.log(`Deselected ${obj.userData.name} from capture list`);
            } else {
              // Limit to 5 satellites to prevent performance issues
              if (selectedSatellites.length >= 5) {
                console.log("Maximum 5 satellites allowed for capture mission");
                return;
              }
              // Select - add to capture list
              selectedSatellites.push(obj);
              console.log(`Selected ${obj.userData.name} for capture`);
            }
            
            // Redraw satellite capture path with error handling
            try {
              drawSatelliteCapturePath(selectedSatellites);
            } catch (error) {
              console.error("Error drawing satellite capture path:", error);
            }
            
            const info = computeSatInfo(obj.userData.rec, obj.userData.name, new Date());
            // Add health and battery to selection info
            if (obj.userData.health !== undefined) {
              info.health = obj.userData.health;
              info.battery = obj.userData.battery;
            }
            
            // Draw green orbit for clicked satellite
            drawSelectedOrbit(obj.userData.rec, getSimDate());
            onSelect?.(info);
            
          } catch (error) {
            console.error("Error handling satellite selection:", error);
          }
        }
      });

      /* ------------------------- tracks & animation ------------------------- */
      function rebuildTracks(simDate) {
        clearTracks();
        if (!tracksOn) return;
        const radius = 1.06;
        const minutes = Math.max(10, Math.min(120, trackMinutes));
        const spanSec = minutes * 60;
        const stepSec = 120;

        const makeLine = (rec, color) => {
          const steps = Math.floor((2*spanSec)/stepSec)+1;
          const positions = new Float32Array(steps*3);
          let idx = 0;
          for (let s = -spanSec; s <= spanSec; s += stepSec) {
            const d = new Date(simDate.getTime() + s*1000);
            const ecef = getECEF(rec, d);
            if (!ecef) continue;
            let x=ecef.x/ Rkm, y=ecef.y/ Rkm, z=ecef.z/ Rkm;
            const len=Math.hypot(x,y,z)||1; x=(x/len)*radius; y=(y/len)*radius; z=(z/len)*radius;
            positions[idx++] = x; positions[idx++] = y; positions[idx++] = z;
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions,3));
          const mat = new THREE.LineBasicMaterial({ color, opacity: 0.55, transparent: true });
          const line = new THREE.Line(geo, mat);
          scene.add(line); trackLines.push(line);
        };

        const limit = Math.min(80, satMeshes.length);
        for (let i=0; i<limit; i++) makeLine(satMeshes[i].userData.rec, 0x56ccf2);
      }
      
      // Draw red orbit for selected satellite
      function drawSelectedOrbit(rec, simDate) {
        // Clear previous selected orbit
        if (selectedOrbitLine.current) {
          scene.remove(selectedOrbitLine.current);
          selectedOrbitLine.current.geometry.dispose();
          selectedOrbitLine.current.material.dispose();
          selectedOrbitLine.current = null;
        }
        
        if (!rec) return;
        
        const radius = 1.06;
        const spanSec = 180 * 60; // 3 hours for full orbit visualization
        const stepSec = 60;
        
        const steps = Math.floor((2*spanSec)/stepSec)+1;
        const positions = new Float32Array(steps*3);
        let idx = 0;
        
        for (let s = -spanSec; s <= spanSec; s += stepSec) {
          const d = new Date(simDate.getTime() + s*1000);
          const ecef = getECEF(rec, d);
          if (!ecef) continue;
          let x=ecef.x/ Rkm, y=ecef.y/ Rkm, z=ecef.z/ Rkm;
          const len=Math.hypot(x,y,z)||1;
          x=(x/len)*radius; y=(y/len)*radius; z=(z/len)*radius;
          positions[idx++] = x; positions[idx++] = y; positions[idx++] = z;
        }
        
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions,3));
        const mat = new THREE.LineBasicMaterial({ 
          color: 0x00ff9f, // Green color for satellite orbits
          opacity: 0.85, 
          transparent: true,
          linewidth: 2
        });
        const line = new THREE.Line(geo, mat);
        scene.add(line);
        selectedOrbitLine.current = line;
      }

      const clock = new THREE.Clock();
      const baseUnixMs = Date.now();
      let simSeconds = 0;
      const getSimDate = () => new Date(baseUnixMs + simSeconds * 1000);
      let trackTimer = 0;

      setStatus("");
      const animate = () => {
        if (destroyed) return;
        raf = requestAnimationFrame(animate);

        const r=3.3;
        camera.position.set(
          r*Math.sin(yaw)*Math.cos(pitch),
          r*Math.sin(pitch),
          r*Math.cos(yaw)*Math.cos(pitch)
        );
        camera.lookAt(0,0,0);

        earthGroup.rotation.y += 0.002;

        const dt = clock.getDelta();
        const simFactor = (state?.simSpeed ?? 1) * (state?.drag ?? 1);
        simSeconds += dt * simFactor * 60;

        const simDate = getSimDate();
        const radius = 1.06;

        const updateSet = (arr) => {
          for (const m of arr) {
            const ecef = getECEF(m.userData.rec, simDate);
            if (!ecef) continue;
            let x=ecef.x/ Rkm, y=ecef.y/ Rkm, z=ecef.z/ Rkm;
            const len=Math.hypot(x,y,z)||1;
            m.position.set((x/len)*radius,(y/len)*radius,(z/len)*radius);
          }
        };
        updateSet(satMeshes);
        updateSet(debMeshes);
        
        // Animate crawler satellite (proper circular orbit) - FIXED
        if (crawlerSatellite.current && crawlerSatellite.current.parent) {
          const crawlerAngle = simSeconds * 0.0008; // Slow orbital speed
          const crawlerRadius = 1.08; // LEO altitude (same as satellites)
          
          // Proper circular orbit in XY plane (equatorial)
          const newX = crawlerRadius * Math.cos(crawlerAngle);
          const newY = crawlerRadius * Math.sin(crawlerAngle);
          const newZ = 0; // Stay in equatorial plane
          
          // Validate position before setting (prevents disappearing bug)
          if (!isNaN(newX) && !isNaN(newY) && !isNaN(newZ)) {
            crawlerSatellite.current.position.set(newX, newY, newZ);
            crawlerSatellite.current.visible = true; // Ensure always visible
            
            // Orient crawler along its orbital path (tangent to orbit)
            crawlerSatellite.current.rotation.z = crawlerAngle + Math.PI / 2;
          }
          
          // Rotate solar panels slowly
          if (crawlerSatellite.current.children[3]) { // panel1
            crawlerSatellite.current.children[3].rotation.y += dt * 0.5;
          }
          if (crawlerSatellite.current.children[4]) { // panel2
            crawlerSatellite.current.children[4].rotation.y += dt * 0.5;
          }
          
          // Pulsate darker blue glow
          if (crawlerSatellite.current.children[5]) { // darker blue glow
            const pulse = Math.sin(simSeconds * 2) * 0.15 + 0.4; // Oscillate between 0.25 and 0.55
            crawlerSatellite.current.children[5].material.opacity = pulse;
          }
          
          // Animate purple dust spreading effect
          if (crawlerSatellite.current.children[6]) { // purple dust layer
            crawlerSatellite.current.children[6].rotation.y += dt * 0.3;
            const purplePulse = Math.sin(simSeconds * 1.5 + Math.PI) * 0.15 + 0.35; // Oscillate
            crawlerSatellite.current.children[6].material.opacity = purplePulse;
          }
          
          // Animate purple particles spreading
          if (crawlerSatellite.current.children[7]) { // outer purple particles
            crawlerSatellite.current.children[7].rotation.x += dt * 0.2;
            crawlerSatellite.current.children[7].rotation.z += dt * 0.25;
            const particlePulse = Math.sin(simSeconds * 1.2) * 0.1 + 0.25; // Oscillate
            crawlerSatellite.current.children[7].material.opacity = particlePulse;
          }
        } else if (crawlerSatellite.current && !crawlerSatellite.current.parent) {
          // Re-add to scene if it was accidentally removed (fixes disappearing bug)
          scene.add(crawlerSatellite.current);
          console.log("Crawler re-added to scene");
        }

        trackTimer += dt;
        if (trackTimer > 10) { trackTimer = 0; if (tracksOn) rebuildTracks(simDate); }

        // keep billboard facing camera if visible
        if (hoverSprite.current?.visible) {
          hoverSprite.current.lookAt(camera.position);
        }

        // Collision detection (check every 5 seconds)
        collisionCheckTimer.current += dt;
        if (collisionCheckTimer.current > 5) {
          collisionCheckTimer.current = 0;
          if (window.satellite && (satMeshes.length > 0 || debMeshes.length > 0)) {
            const allObjects = [...satMeshes, ...debMeshes];
            const detected = detectCollisions(allObjects, simDate, window.satellite, state?.drag ?? 1.0);
            setCollisions(detected);
          }
        }

        renderer.render(scene, camera);
      };
      animate();

      // respond to prop changes
      let lastType=overlayType, lastDate=overlayDate;
      const poll = setInterval(() => {
        if (lastType!==overlayType || lastDate!==overlayDate) {
          lastType=overlayType; lastDate=overlayDate;
          setOverlay(overlayType, overlayDate || new Date().toISOString().slice(0,10));
        }
      }, 400);

      // cleanup
      return () => {
        destroyed = true;
        clearInterval(poll);
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (renderer) renderer.dispose();
      };
    })();
  }, [overlayType, overlayDate, state.simSpeed, state.drag, tracksOn, trackMinutes]);

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ minHeight: 520, position: "relative" }}>
      <canvas ref={canvasRef} className="canvas3d" />
      {status && (
        <div style={{
          position:"absolute", inset:0, display:"grid", placeItems:"center",
          background:"linear-gradient(180deg,rgba(7,11,18,.6),rgba(7,11,18,.3))",
          fontSize:14, color:"#cbd5e1"
        }}>{status}</div>
      )}

      {/* Collision Warnings */}
      <CollisionWarnings collisions={collisions} />

      <div className="badgelite" style={{
        position:"absolute", left:10, bottom:10,
        background:"rgba(15,23,42,.85)", backdropFilter:"blur(12px)",
        color:"#dbeafe", fontSize:11, padding:"8px 12px", borderRadius:10,
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#0066cc", boxShadow:"0 0 6px #0066cc, 0 0 12px #9966ff"}}/> 🤖 Crawler
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#0099ff"}}/> Healthy
          </span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#ffd600"}}/> Aging
          </span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#ff6b6b"}}/> Critical
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#6366f1", boxShadow:"0 0 4px #6366f1"}}/> Selected
          </span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#ff7b72"}}/> Debris
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#4B0082"}}/> Selected Debris
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#00ff9f"}}/> Satellite Orbits
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#ff0000"}}/> Collection Path
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#00ff9f"}}/> Capture Path
          </span>
          <span style={{ margin: "0 4px", color: "#555" }}>|</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
            <span className="dot" style={{background:"#ff0000"}}/> Crawler Orbit
          </span>
        </div>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "#aaa" }}>
          💡 Click debris to select · Click satellites to capture · Red line = collection path · Green line = capture path · Red orbit = crawler intercept
        </div>
        {overlayInfo?.layer ? (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "#aaa" }}>
            Overlay: <b style={{ color: "#00d4ff" }}>{overlayInfo.layer}</b>
          </div>
        ) : null}
        {banner ? (
          <div style={{ marginTop: 4, fontSize: 10, color: "#ffd600" }}>{banner}</div>
        ) : null}
      </div>

      {/* Track controls */}
      <div style={{
        position:"absolute", right:10, top:10,
        background:"rgba(2,6,23,.55)", border:"1px solid rgba(148,163,184,.15)",
        borderRadius:10, padding:"8px 10px", color:"#dbeafe", fontSize:12,
        display:"flex", alignItems:"center", gap:10, backdropFilter:"blur(6px)"
      }}>
        <label style={{display:"flex",gap:6,alignItems:"center",cursor:"pointer"}}>
          <input type="checkbox" checked={tracksOn} onChange={e=>setTracksOn(e.target.checked)} />
          Tracks
        </label>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span>±</span>
          <input
            type="range" min={10} max={120} step={10}
            value={trackMinutes}
            onChange={e=>setTrackMinutes(parseInt(e.target.value||"40",10))}
          />
          <span>{trackMinutes}m</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------- info & formatting helpers --------------------- */
function computeSatInfo(rec, name, date) {
  try {
    if (rec.mode === "synthetic") {
      const ecef = getECEFfromSynthetic(rec, date);
      const altKm = Math.sqrt(ecef.x*ecef.x + ecef.y*ecef.y + ecef.z*ecef.z) - Rkm;
      // quick lon/lat from ECEF
      const lon = Math.atan2(ecef.y, ecef.x);
      const hyp = Math.hypot(ecef.x, ecef.y);
      const lat = Math.atan2(ecef.z, hyp);
      return {
        name,
        alt_km: Math.round(altKm),
        lat_deg: +(lat * 180/Math.PI).toFixed(2),
        lon_deg: +(((lon * 180/Math.PI + 540) % 360) - 180).toFixed(2),
        inc_deg: +(rec.inc * 180/Math.PI).toFixed(2),
        raan_deg: +(rec.raan * 180/Math.PI).toFixed(2)
      };
    }
    const pv = window.satellite.propagate(rec, date);
    const gmst = window.satellite.gstime(date);
    const ecef = window.satellite.eciToEcf(pv.position, gmst);
    const llh  = window.satellite.eciToGeodetic(pv.position, gmst);
    const altKm = (Math.sqrt(ecef.x*ecef.x + ecef.y*ecef.y + ecef.z*ecef.z) - Rkm);
    const inc  = (rec.inclo || rec.inclination) * 180/Math.PI;
    const raan = (rec.nodeo || rec.raan) * 180/Math.PI;
    return {
      name,
      alt_km: Math.round(altKm),
      lat_deg: +(llh.latitude * 180/Math.PI).toFixed(2),
      lon_deg: +(((llh.longitude * 180/Math.PI + 540) % 360) - 180).toFixed(2),
      inc_deg: +inc.toFixed(2),
      raan_deg: +raan.toFixed(2)
    };
  } catch {
    return { name, alt_km: NaN };
  }
}
function shortName(s){ return (s||"").length>18 ? s.slice(0,18)+"…" : s; }
function fmt(v){ return (v===undefined||isNaN(v)) ? "—" : (+v).toFixed(1); }
