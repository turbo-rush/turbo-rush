import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Props = { carColor: number; carModel: number; onFinish: (score: number) => void };
type Controls = { left: boolean; right: boolean; throttle: boolean; brake: boolean; nitro: boolean };

const TRACK_POINTS = [
  [-34, 0, 0], [-24, 0, -25], [-4, 0, -34], [22, 0, -29],
  [36, 0, -10], [32, 0, 12], [15, 0, 31], [-10, 0, 34],
  [-31, 0, 22], [-39, 0, 8]
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

function makeRibbon(curve: THREE.Curve<THREE.Vector3>, width: number, segments = 420) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const left = point.clone().addScaledVector(side, width / 2);
    const right = point.clone().addScaledVector(side, -width / 2);
    positions.push(left.x, 0.08, left.z, right.x, 0.08, right.z);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCar(color: number, model: number) {
  const group = new THREE.Group();
  const paint = new THREE.MeshToonMaterial({ color });
  const dark = new THREE.MeshToonMaterial({ color: 0x111722 });
  const glass = new THREE.MeshToonMaterial({ color: 0x173b55 });
  const rubber = new THREE.MeshToonMaterial({ color: 0x090d13 });
  const metal = new THREE.MeshToonMaterial({ color: 0xb9c5cf });
  const addOutlinedBox = (
    width: number, height: number, depth: number,
    material: THREE.Material, position: THREE.Vector3,
    outlineScale = 1.045
  ) => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const shell = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0x10131b, side: THREE.BackSide
    }));
    shell.scale.setScalar(outlineScale);
    shell.position.copy(position);
    group.add(shell);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    group.add(mesh);
    return mesh;
  };

  addOutlinedBox(2.15, 0.72, 4.15, paint, new THREE.Vector3(0, 0.78, 0));
  addOutlinedBox(1.62, 0.7, 2.05, glass, new THREE.Vector3(0, 1.38, -0.18), 1.035);
  addOutlinedBox(1.55, 0.12, 1.35, paint, new THREE.Vector3(0, 1.76, -0.22), 1.06);

  const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.34, 12);
  const rimGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.355, 10);
  for (const x of [-1.12, 1.12]) for (const z of [-1.28, 1.28]) {
    const wheel = new THREE.Mesh(wheelGeometry, rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.48, z);
    group.add(wheel);
    const rim = new THREE.Mesh(rimGeometry, metal);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x * 1.012, 0.48, z);
    group.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.37, 8), dark);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x * 1.018, 0.48, z);
    group.add(hub);
  }

  addOutlinedBox(2.28, 0.2, 0.28, dark, new THREE.Vector3(0, 0.48, -2.08));
  addOutlinedBox(2.35, 0.12, 0.38, dark, new THREE.Vector3(0, 1.08, 1.75));
  for (const x of [-0.8, 0.8]) {
    addOutlinedBox(0.12, 0.38, 0.12, dark, new THREE.Vector3(x, 0.9, 1.72), 1.08);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
    lamp.position.set(x * 0.9, 0.9, -2.1);
    group.add(lamp);
  }

  // Bold comic-style hood stripes and front splitter
  const stripeColor = model % 2 === 0 ? 0xffffff : 0x171d28;
  for (const x of [-0.36, 0.36]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 1.12), new THREE.MeshBasicMaterial({ color: stripeColor }));
    stripe.position.set(x, 1.151, -1.28);
    group.add(stripe);
  }
  addOutlinedBox(2.5, 0.13, 0.28, dark, new THREE.Vector3(0, 0.43, -2.18), 1.035);

  // Side skirts and rear diffuser add a stronger racing silhouette
  for (const x of [-1.08, 1.08]) {
    addOutlinedBox(0.16, 0.2, 2.35, dark, new THREE.Vector3(x, 0.43, 0.05), 1.06);
  }
  addOutlinedBox(1.45, 0.12, 0.42, dark, new THREE.Vector3(0, 0.42, 2.12));

  group.scale.setScalar(model === 2 ? 0.94 : model === 4 ? 1.04 : 1);
  return group;
}

export default function Race3DPrototype({ carColor, carModel, onFinish }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls>({ left: false, right: false, throttle: true, brake: false, nitro: false });
  const finishRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [hud, setHud] = useState({ speed: 0, lap: 1, time: 0, position: 1 });
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bd8ed);
    scene.fog = new THREE.Fog(0x9bd8ed, 85, 175);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 260);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x42613d, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-35, 65, -25);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({ color: 0x55a95b, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    scene.add(ground);

    const curve = new THREE.CatmullRomCurve3(TRACK_POINTS, true, "centripetal");
    const road = new THREE.Mesh(makeRibbon(curve, 15), new THREE.MeshStandardMaterial({ color: 0x343943, roughness: 0.92, side: THREE.DoubleSide }));
    scene.add(road);
    const curb = new THREE.Mesh(makeRibbon(curve, 17.1), new THREE.MeshStandardMaterial({ color: 0xe8e3d7, roughness: 1, side: THREE.DoubleSide }));
    curb.position.y = -0.025;
    scene.add(curb);
    const redCurb = new THREE.Mesh(makeRibbon(curve, 16.2), new THREE.MeshStandardMaterial({ color: 0xd94b4b, roughness: 1, side: THREE.DoubleSide }));
    redCurb.position.y = 0.015;
    scene.add(redCurb);

    // Continuous bright edge lines and reflective road studs improve road readability
    const edgeLineMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f0df });
    const studMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36b });
    for (let i = 0; i < 120; i++) {
      const t = i / 120;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const yaw = Math.atan2(tangent.x, tangent.z);
      for (const edge of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 1.15), edgeLineMaterial);
        const linePosition = p.clone().addScaledVector(side, edge * 7.05);
        line.position.set(linePosition.x, 0.17, linePosition.z);
        line.rotation.y = yaw;
        scene.add(line);
        if (i % 4 === 0) {
          const stud = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.16), studMaterial);
          const studPosition = p.clone().addScaledVector(side, edge * 7.55);
          stud.position.set(studPosition.x, 0.19, studPosition.z);
          stud.rotation.y = yaw;
          scene.add(stud);
        }
      }
    }

    const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xf5f1e8 });
    for (let i = 0; i < 90; i++) {
      const t = i / 90;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 1.25), dashMaterial);
      dash.position.set(p.x, 0.15, p.z);
      dash.rotation.y = Math.atan2(tangent.x, tangent.z);
      scene.add(dash);
    }

    // Low-poly city blocks beyond the roadside, kept lightweight for mobile
    const buildingPalette = [0x52647e, 0x394c68, 0x7a5368, 0x566b72, 0x665b82];
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd88a });
    for (let i = 0; i < 22; i++) {
      const t = (i / 22 + 0.015) % 1;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const sideDirection = i % 2 === 0 ? 1 : -1;
      const base = p.clone().addScaledVector(side, sideDirection * (15.5 + (i % 3) * 1.8));
      const height = 8 + (i % 5) * 2.4;
      const width = 5.2 + (i % 3) * 1.2;
      const depth = 5.2 + (i % 2) * 1.4;
      const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
      const buildingMaterial = new THREE.MeshToonMaterial({ color: buildingPalette[i % buildingPalette.length] });
      const outline = new THREE.Mesh(buildingGeometry, new THREE.MeshBasicMaterial({ color: 0x172234, side: THREE.BackSide }));
      outline.scale.set(1.055, 1.035, 1.055);
      const buildingYaw = Math.atan2(tangent.x, tangent.z);
      outline.position.set(base.x, height / 2, base.z);
      outline.rotation.y = buildingYaw;
      scene.add(outline);
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.copy(outline.position);
      building.rotation.y = buildingYaw;
      scene.add(building);
      const windowPanel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.62, 0.08), windowMaterial);
      const roadFacing = base.clone().addScaledVector(side, -sideDirection * (depth / 2 + 0.08));
      windowPanel.position.set(roadFacing.x, Math.min(height - 1, 2.8 + (i % 3) * 1.5), roadFacing.z);
      windowPanel.rotation.y = buildingYaw;
      scene.add(windowPanel);
    }

    // Bright roadside comic billboards make the city read clearly from the racing camera
    const billboardColors = [0x19d9ff, 0xff4f91, 0xffc83d, 0x9b78ff];
    for (let i = 0; i < 12; i++) {
      const t = (i / 12 + 0.04) % 1;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const sideDirection = i % 2 === 0 ? 1 : -1;
      const base = p.clone().addScaledVector(side, sideDirection * 12.2);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 1.9, 0.22),
        new THREE.MeshBasicMaterial({ color: 0x111b2b })
      );
      frame.position.set(base.x, 4.1, base.z);
      frame.rotation.y = yaw;
      scene.add(frame);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(3.12, 1.52, 0.08),
        new THREE.MeshBasicMaterial({ color: billboardColors[i % billboardColors.length] })
      );
      panel.position.set(base.x, 4.1, base.z - 0.14);
      panel.rotation.y = yaw;
      scene.add(panel);
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(2.25, 0.12, 0.04),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      accent.position.set(base.x, 3.72, base.z - 0.2);
      accent.rotation.y = yaw;
      scene.add(accent);
    }

    const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffe6a6 });
    const poleMaterial = new THREE.MeshToonMaterial({ color: 0x26364b });
    for (let i = 0; i < 18; i++) {
      const p = curve.getPointAt(i / 18);
      const tangent = curve.getTangentAt(i / 18);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const base = p.clone().addScaledVector(side, i % 2 === 0 ? 10.5 : -10.5);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 5), poleMaterial);
      pole.position.set(base.x, 2.1, base.z);
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), poleMaterial);
      arm.position.set(base.x + 0.38, 4.15, base.z);
      scene.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.28), lampMaterial);
      lamp.position.set(base.x + 0.78, 4.08, base.z);
      scene.add(lamp);
    }

    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x267844, roughness: 1 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x76513a });
    for (let i = 0; i < 34; i++) {
      const t = (i / 34 + 0.025) % 1;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      for (const sign of [-1, 1]) {
        const base = p.clone().addScaledVector(side, sign * (27 + (i % 3) * 3));
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 6), trunkMaterial);
        trunk.position.set(base.x, 0.8, base.z);
        scene.add(trunk);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + (i % 3) * 0.2, 1), treeMaterial);
        crown.position.set(base.x, 2.5, base.z);
        scene.add(crown);
      }
    }

    const player = makeCar(carColor, carModel);
    scene.add(player);
    const nitroFlames = [-0.62, 0.62].map(x => {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 1.05, 7),
        new THREE.MeshBasicMaterial({ color: 0x36dfff })
      );
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, 0.62, 2.48);
      flame.visible = false;
      player.add(flame);
      return flame;
    });
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0xcbd5df, transparent: true, opacity: 0.32 });
    const smokePuffs = Array.from({ length: 10 }, () => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), smokeMaterial.clone());
      puff.visible = false;
      scene.add(puff);
      return { mesh: puff, life: 0 };
    });
    let smokeCursor = 0;

    // Short comic speed streaks appear beside the road at high speed
    const speedStreaks = Array.from({ length: 14 }, (_, i) => {
      const streak = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.045, 1.4 + (i % 3) * 0.55),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0x8cecff, transparent: true, opacity: 0.72 })
      );
      streak.visible = false;
      scene.add(streak);
      return streak;
    });

    const rivals = [0xffc629, 0xf04f68, 0x9b70ed].map((color, i) => {
      const rival = makeCar(color, i + 1);
      scene.add(rival);
      return rival;
    });

    let progress = 0;
    const rivalProgress = [-0.075, -0.12, -0.165];
    let lateral = 0;
    let speed = 0;
    let elapsed = 0;
    let last = 0;
    let hudTimer = 0;
    let raf = 0;
    const totalLaps = 3;

    const placeCar = (car: THREE.Group, t: number, offset: number) => {
      const p = curve.getPointAt(((t % 1) + 1) % 1);
      const tangent = curve.getTangentAt(((t % 1) + 1) % 1).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      p.addScaledVector(side, offset);
      car.position.set(p.x, 0.02, p.z);
      car.rotation.y = Math.atan2(tangent.x, tangent.z);
    };

    const resize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - (last || now)) / 1000, 0.04);
      last = now;
      if (!finishRef.current) {
        elapsed += dt;
        const c = controlsRef.current;
        const maxSpeed = c.nitro ? 0.115 : 0.082;
        const acceleration = c.brake ? -0.2 : c.throttle ? 0.105 : -0.035;
        speed = THREE.MathUtils.clamp(speed + acceleration * dt, 0, maxSpeed);
        const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        lateral = THREE.MathUtils.clamp(lateral + steer * (0.9 + speed * 8) * dt, -5.2, 5.2);
        nitroFlames.forEach((flame, i) => {
          flame.visible = c.nitro && speed > 0.025;
          flame.scale.setScalar(flame.visible ? 0.78 + Math.random() * 0.48 : 0.001);
          flame.position.z = 2.42 + Math.random() * 0.18;
          flame.material = flame.material;
        });
        if (Math.abs(steer) > 0 && speed > 0.035 && Math.random() < 0.42) {
          const puff = smokePuffs[smokeCursor];
          smokeCursor = (smokeCursor + 1) % smokePuffs.length;
          puff.life = 0.55;
          puff.mesh.visible = true;
          const wheelSide = Math.random() < 0.5 ? -1 : 1;
          const rear = player.localToWorld(new THREE.Vector3(wheelSide * 1.05, 0.34, 1.55));
          puff.mesh.position.copy(rear);
          puff.mesh.scale.setScalar(0.55);
          (puff.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3;
        }
        smokePuffs.forEach(puff => {
          if (puff.life <= 0) return;
          puff.life -= dt;
          puff.mesh.position.y += dt * 1.15;
          puff.mesh.scale.multiplyScalar(1 + dt * 1.5);
          (puff.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, puff.life / 0.55) * 0.3;
          if (puff.life <= 0) puff.mesh.visible = false;
        });
        progress += speed * dt;
        if (progress >= totalLaps) {
          finishRef.current = true;
          setFinished(true);
          onFinishRef.current(Math.max(100, Math.round(1200 - elapsed * 4)));
        }
        hudTimer += dt;
        if (hudTimer > 0.12) {
          setHud({ speed: Math.round(speed * 1500), lap: Math.min(totalLaps, Math.floor(progress) + 1), time: elapsed, position: 1 + rivalProgress.filter(rival => rival > progress).length });
          hudTimer = 0;
        }
      }
      const t = progress % 1;
      placeCar(player, t, lateral);
      const tangent = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const lookAhead = curve.getPointAt((t + 0.018) % 1);
      camera.position.lerp(new THREE.Vector3(player.position.x - tangent.x * 9, 25, player.position.z - tangent.z * 9 + 12), 0.075);
      const targetFov = controlsRef.current.nitro && speed > 0.025 ? 57 : speed > 0.055 ? 52 : 48;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
      camera.updateProjectionMatrix();
      camera.lookAt(player.position.x + side.x * lateral * 0.12, 0, player.position.z + side.z * lateral * 0.12);
      rivals.forEach((rival, i) => {
        if (!finishRef.current) rivalProgress[i] += dt * (0.047 + i * 0.006);
        placeCar(rival, rivalProgress[i], (i - 1) * 2.2);
      });
      speedStreaks.forEach((streak, i) => {
        const active = speed > 0.052;
        streak.visible = active;
        if (!active) return;
        const streakT = (t + 0.012 + i * 0.0018) % 1;
        const streakPoint = curve.getPointAt(streakT);
        const streakTangent = curve.getTangentAt(streakT).normalize();
        const streakSide = new THREE.Vector3(-streakTangent.z, 0, streakTangent.x);
        const sideSign = i % 2 === 0 ? -1 : 1;
        streakPoint.addScaledVector(streakSide, sideSign * (8.8 + (i % 4) * 1.05));
        streak.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(streakTangent.x, streakTangent.z));
        streak.position.set(streakPoint.x, 0.45 + (i % 3) * 0.18, streakPoint.z);
        streak.scale.z = controlsRef.current.nitro ? 1.8 : 1;
      });
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [carColor, carModel]);

  const press = (key: keyof Controls, value: boolean) => { controlsRef.current[key] = value; };
  const buttonStyle: React.CSSProperties = { minHeight: 48, borderRadius: 12, border: "1px solid #6c8192", background: "rgba(12,24,38,.92)", color: "#fff", fontWeight: 900, touchAction: "none", userSelect: "none" };
  return <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 16, background: "#9bd8ed" }}>
    <div ref={mountRef} style={{ width: "100%", height: "min(66vh, 590px)" }} />
    <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", color: "#fff", fontWeight: 900, fontSize: 12, textShadow: "0 2px 4px #111" }}>
      <span>LAP {hud.lap}/3</span><span>POS {hud.position}/4</span><span>{hud.speed} KM/H</span><span>{hud.time.toFixed(1)}s</span>
    </div>
    {finished && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#07111dcc", color: "#fff", fontSize: 28, fontWeight: 900 }}>FINISH!</div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7, padding: 9, background: "#0c1a2b" }}>
      <button style={buttonStyle} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press("left", true); }} onPointerUp={() => press("left", false)} onPointerCancel={() => press("left", false)}>◀</button>
      <button style={buttonStyle} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press("right", true); }} onPointerUp={() => press("right", false)} onPointerCancel={() => press("right", false)}>▶</button>
      <button style={buttonStyle} onPointerDown={() => press("brake", true)} onPointerUp={() => press("brake", false)} onPointerCancel={() => press("brake", false)}>BRAKE</button>
      <button style={{ ...buttonStyle, background: "#db6227" }} onPointerDown={() => press("nitro", true)} onPointerUp={() => press("nitro", false)} onPointerCancel={() => press("nitro", false)}>NITRO</button>
      <button style={{ ...buttonStyle, background: "#176184" }} onPointerDown={() => press("throttle", true)} onPointerUp={() => press("throttle", false)} onPointerCancel={() => press("throttle", false)}>GAS</button>
    </div>
  </div>;
}