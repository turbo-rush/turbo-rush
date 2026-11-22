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
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111722, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x173b55, roughness: 0.22, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 4.15), paint);
  body.position.y = 0.78;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.7, 2.05), glass);
  cabin.position.set(0, 1.38, -0.18);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 1.35), paint);
  roof.position.set(0, 1.76, -0.22);
  group.add(roof);
  const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.34, 12);
  for (const x of [-1.12, 1.12]) for (const z of [-1.28, 1.28]) {
    const wheel = new THREE.Mesh(wheelGeometry, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.48, z);
    group.add(wheel);
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.2, 0.28), dark);
  bumper.position.set(0, 0.48, 2.08);
  group.add(bumper);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 0.38), dark);
  spoiler.position.set(0, 1.08, 1.75);
  group.add(spoiler);
  const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
  for (const x of [-0.72, 0.72]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headlightMaterial);
    lamp.position.set(x, 0.9, -2.1);
    group.add(lamp);
  }
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0x10131b, linewidth: 2 })
  );
  outline.position.copy(body.position);
  group.add(outline);
  group.scale.setScalar(model === 2 ? 0.94 : model === 4 ? 1.04 : 1);
  return group;
}

export default function Race3DPrototype({ carColor, carModel, onFinish }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls>({ left: false, right: false, throttle: true, brake: false, nitro: false });
  const finishRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [hud, setHud] = useState({ speed: 0, lap: 1, time: 0 });
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

    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x267844, roughness: 1 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x76513a });
    for (let i = 0; i < 34; i++) {
      const t = (i / 34 + 0.025) % 1;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      for (const sign of [-1, 1]) {
        const base = p.clone().addScaledVector(side, sign * (14 + (i % 3) * 3));
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
    const rivals = [0xffc629, 0xf04f68, 0x9b70ed].map((color, i) => {
      const rival = makeCar(color, i + 1);
      scene.add(rival);
      return rival;
    });

    let progress = 0;
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
        progress += speed * dt;
        if (progress >= totalLaps) {
          finishRef.current = true;
          setFinished(true);
          onFinishRef.current(Math.max(100, Math.round(1200 - elapsed * 4)));
        }
        hudTimer += dt;
        if (hudTimer > 0.12) {
          setHud({ speed: Math.round(speed * 1500), lap: Math.min(totalLaps, Math.floor(progress) + 1), time: elapsed });
          hudTimer = 0;
        }
      }
      const t = progress % 1;
      placeCar(player, t, lateral);
      const tangent = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const lookAhead = curve.getPointAt((t + 0.018) % 1);
      camera.position.lerp(new THREE.Vector3(player.position.x - tangent.x * 9, 25, player.position.z - tangent.z * 9 + 12), 0.075);
      camera.lookAt(player.position.x + side.x * lateral * 0.12, 0, player.position.z + side.z * lateral * 0.12);
      rivals.forEach((rival, i) => placeCar(rival, t + 0.985 - i * 0.012, (i - 1) * 2.5));
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
      <span>LAP {hud.lap}/3</span><span>{hud.speed} KM/H</span><span>{hud.time.toFixed(1)}s</span>
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