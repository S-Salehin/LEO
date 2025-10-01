import { useEffect, useRef } from "react";

/** Demo capture: satellite claw picks a debris cube and stows it. */
export default function ClawDemo() {
  const hostRef = useRef(null);
  const animRef = useRef({});

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !window.THREE) return;

    const THREE = window.THREE;
    const width = el.clientWidth;
    const height = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a14);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(3.5, 2.2, 5.5);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);

    // Lights
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x0a0e18, 0.8);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(4, 6, 3);
    scene.add(key);

    // Starfield backdrop (tiny points)
    const starGeo = new THREE.BufferGeometry();
    const stars = new Float32Array(6000);
    for (let i = 0; i < stars.length; i += 3) {
      stars[i] = (Math.random() - 0.5) * 80;
      stars[i + 1] = (Math.random() - 0.5) * 80;
      stars[i + 2] = (Math.random() - 0.5) * 80;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x7aa2ff, size: 0.02 });
    scene.add(new THREE.Points(starGeo, starMat));

    // “Earth” just for context
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0x1a2a44,
        roughness: 0.9,
        metalness: 0.0
      })
    );
    earth.position.set(-1.6, -0.7, -1.4);
    scene.add(earth);

    // Satellite body
    const sat = new THREE.Group();
    scene.add(sat);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8fb5ff, metalness: 0.3, roughness: 0.5 })
    );
    body.position.set(0, 0.5, 0);
    sat.add(body);

    // Simple solar panels
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x214f9a, metalness: 0.2, roughness: 0.8 });
    const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.1), panelMat);
    const panelR = panelL.clone();
    panelL.position.set(-0.45, 0.5, 0);
    panelR.position.set(0.45, 0.5, 0);
    sat.add(panelL, panelR);

    // Claw base -> arm -> gripper
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 24), new THREE.MeshStandardMaterial({ color: 0x9dbcf9 }));
    base.position.set(0.4, 0.55, 0.18);
    base.rotation.z = Math.PI * 0.5;
    sat.add(base);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0xcfe1ff }));
    arm.position.set(0.85, 0.55, 0.18); // extended origin; we'll animate length via scale
    arm.rotation.z = Math.PI * 0.5;
    arm.scale.x = 0.01; // start retracted
    sat.add(arm);

    const gripper = new THREE.Group();
    const fingerGeo = new THREE.BoxGeometry(0.02, 0.12, 0.04);
    const fingerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const f1 = new THREE.Mesh(fingerGeo, fingerMat);
    const f2 = f1.clone();
    const f3 = f1.clone();
    f1.position.set(1.3, 0.55, 0.18);
    f2.position.set(1.3, 0.55, 0.18);
    f3.position.set(1.3, 0.55, 0.18);
    f1.rotation.z = 0.6;
    f2.rotation.z = -0.6;
    f3.rotation.y = 1.05;
    gripper.add(f1, f2, f3);
    sat.add(gripper);

    // Debris (cube)
    const debris = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xff8f8f, metalness: 0.1, roughness: 0.7 })
    );
    debris.position.set(1.55, 0.55, 0.18);
    scene.add(debris);

    // Animation state machine
    const state = {
      t: 0,
      phase: 0, // 0: extend, 1: close, 2: retract, 3: done loop
      attached: false
    };
    animRef.current.state = state;

    function animate() {
      state.t += 0.016;

      // simple orbit vibe
      sat.rotation.y += 0.002;
      earth.rotation.y += 0.0008;
      debris.rotation.x += 0.01;
      debris.rotation.y -= 0.008;

      if (state.phase === 0) {
        // extend arm to reach debris
        arm.scale.x = Math.min(1, arm.scale.x + 0.02);
        if (arm.scale.x >= 0.98) state.phase = 1;
      } else if (state.phase === 1) {
        // close gripper (fake by rotating fingers toward center)
        f1.rotation.z = Math.max(0.2, f1.rotation.z - 0.02);
        f2.rotation.z = Math.min(-0.2, f2.rotation.z + 0.02);
        if (!state.attached && f1.rotation.z <= 0.22) {
          state.attached = true;
        }
        if (f1.rotation.z <= 0.22) state.phase = 2;
      } else if (state.phase === 2) {
        // retract with debris attached
        arm.scale.x = Math.max(0.01, arm.scale.x - 0.02);
        if (state.attached) {
          // move debris with gripper tip
          const tipX = 0.4 + (0.9 * arm.scale.x) + 0.02;
          debris.position.set(tipX + 0.85, 0.55, 0.18);
        }
        if (arm.scale.x <= 0.02) state.phase = 3;
      } else if (state.phase === 3) {
        // stow: slide debris inside body and reset loop
        debris.position.lerp(new THREE.Vector3(0.25, 0.55, 0.18), 0.05);
        if (debris.position.distanceTo(new THREE.Vector3(0.25, 0.55, 0.18)) < 0.02) {
          // Reset for loop
          debris.position.set(1.55, 0.55, 0.18);
          state.phase = 0;
          arm.scale.x = 0.01;
          f1.rotation.z = 0.6;
          f2.rotation.z = -0.6;
          state.attached = false;
        }
      }

      renderer.render(scene, camera);
      animRef.current.id = requestAnimationFrame(animate);
    }
    animRef.current.id = requestAnimationFrame(animate);

    function onResize() {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(animRef.current.id);
      ro.disconnect();
      el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ width: "100%", height: 340, border: "1px solid #203049", borderRadius: 10 }} ref={hostRef} />
  );
}
