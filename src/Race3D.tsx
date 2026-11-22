import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Race3DProps = {
  carColor: number;
  carModel: number;
  onFinish: (score: number) => void;
};

export default function Race3D({ carColor, carModel, onFinish }: Race3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<"top" | "angle">("angle");
  const [steeringAngle, setSteeringAngle] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );


if (cameraMode === "top") {
  // Строго сверху
  camera.position.set(0, 34, 3);
  camera.lookAt(0, 0, -8);
} else {
  // Сверху под углом
  camera.position.set(0, 22, 19);
  camera.lookAt(0, 0, -8);
}
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x445566, 2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(5, 12, 8);
    sun.castShadow = true;
    scene.add(sun);

    // Замкнутая гоночная трасса в духе Circuit Superstars
    // Собственная конфигурация: длинные дуги, связки поворотов и шпилька
    const trackPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 4),
      new THREE.Vector3(9, 0, 5),
      new THREE.Vector3(16, 0, 1),
      new THREE.Vector3(18, 0, -6),
      new THREE.Vector3(13, 0, -13),
      new THREE.Vector3(3, 0, -16),
      new THREE.Vector3(-8, 0, -14),
      new THREE.Vector3(-16, 0, -9),
      new THREE.Vector3(-19, 0, -1),
      new THREE.Vector3(-16, 0, 7),
      new THREE.Vector3(-9, 0, 13),
      new THREE.Vector3(-1, 0, 14),
      new THREE.Vector3(5, 0, 10)
    ], true, "centripetal");

    const trackSamples = 260;
    const roadHalfWidth = 6;
    const getTrackFrame = (t: number) => {
      const point = trackPath.getPointAt(t);
      const tangent = trackPath.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      return { point, tangent, normal };
    };

    const makeRibbon = (offset: number, halfWidth: number, y: number) => {
      const vertices = new Float32Array((trackSamples + 1) * 2 * 3);
      const indices: number[] = [];
      for (let i = 0; i <= trackSamples; i++) {
        const t = i / trackSamples;
        const { point, normal } = getTrackFrame(t);
        const center = point.clone().addScaledVector(normal, offset);
        const left = center.clone().addScaledVector(normal, -halfWidth);
        const right = center.clone().addScaledVector(normal, halfWidth);
        const k = i * 6;
        vertices[k] = left.x; vertices[k + 1] = y; vertices[k + 2] = left.z;
        vertices[k + 3] = right.x; vertices[k + 4] = y; vertices[k + 5] = right.z;
        if (i < trackSamples) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const road = new THREE.Mesh(
      makeRibbon(0, roadHalfWidth, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x34343b, roughness: 0.94, side: THREE.DoubleSide })
    );
    road.receiveShadow = true;
    scene.add(road);

    // Красно-белые поребрики вдоль обеих сторон дороги
    const curbMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xe94b45, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8 })
    ];
    const curbGeometry = new THREE.BoxGeometry(0.92, 0.18, 1.18);
    for (let side of [-1, 1]) {
      for (let i = 0; i < 220; i++) {
        const t = i / 220;
        const { point, tangent, normal } = getTrackFrame(t);
        const curb = new THREE.Mesh(curbGeometry, curbMaterials[i % 2]);
        const curbPosition = point.clone().addScaledVector(normal, side * (roadHalfWidth + 0.48));
        curb.position.set(curbPosition.x, 0.12, curbPosition.z);
        curb.rotation.y = Math.atan2(tangent.x, tangent.z);
        curb.castShadow = true;
        scene.add(curb);
      }
    }

    // Защитные ограждения по внешним краям трассы
    for (let side of [-1, 1]) {
      const barrierPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= trackSamples; i++) {
        const { point, normal } = getTrackFrame(i / trackSamples);
        barrierPoints.push(
          point.clone().addScaledVector(normal, side * (roadHalfWidth + 1.35)).setY(0.62)
        );
      }
      const barrierCurve = new THREE.CatmullRomCurve3(barrierPoints, true);
      const barrier = new THREE.Mesh(
        new THREE.TubeGeometry(barrierCurve, trackSamples, 0.2, 7, true),
        new THREE.MeshStandardMaterial({ color: 0x89949b, metalness: 0.55, roughness: 0.45 })
      );
      barrier.castShadow = true;
      scene.add(barrier);
    }

    // Короткая пунктирная разметка по центру асфальта
    for (let i = 0; i < 44; i++) {
      const t = i / 44;
      const { point, tangent } = getTrackFrame(t);
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.045, 1.25),
        new THREE.MeshBasicMaterial({ color: 0xf3f0e5 })
      );
      dash.position.set(point.x, 0.09, point.z);
      dash.rotation.y = Math.atan2(tangent.x, tangent.z);
      scene.add(dash);
    }

    // Земля
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(200, 0.1, 120),
      new THREE.MeshStandardMaterial({ color: 0x36a852 })
    );
    ground.position.set(0, -0.2, -35);
    scene.add(ground);

    // Компактная мультяшная гоночная машина в духе Circuit Superstars
    const car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.52, 2.85),
      new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.38 })
    );
    body.position.y = 0.58;
    body.castShadow = true;
    car.add(body);

    // Низкий кокпит с тёмным остеклением
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.48, 1.28),
      new THREE.MeshStandardMaterial({ color: 0x142b42, roughness: 0.22, metalness: 0.12 })
    );
    cabin.position.set(0, 1.02, -0.18);
    cabin.castShadow = true;
    car.add(cabin);

    // Небольшой передний сплиттер и задний спойлер
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: 0.65 });
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.28), trimMaterial);
    splitter.position.set(0, 0.38, 1.42);
    car.add(splitter);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.22), trimMaterial);
    spoiler.position.set(0, 0.88, -1.38);
    car.add(spoiler);

    // Компактные широкие шины
    for (const x of [-0.84, 0.84]) {
      for (const z of [-0.88, 0.88]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.29, 0.29, 0.2, 16),
          new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.92 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.39, z);
        car.add(wheel);
      }
    }

    // Передние фары
    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1c2 });
    for (const x of [-0.48, 0.48]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), headlightMaterial);
      headlight.position.set(x, 0.62, 1.43);
      car.add(headlight);
    }

    const startFrame = getTrackFrame(0);
    car.position.set(startFrame.point.x, 0, startFrame.point.z);
    const baseHeading = Math.atan2(startFrame.tangent.x, startFrame.tangent.z);
    car.rotation.y = baseHeading;
    // Состояние нитро
let nitroActive = false;

const handleNitro = (event: Event) => {
  const customEvent = event as CustomEvent<boolean>;
  nitroActive = customEvent.detail;
};

window.addEventListener("turbo-nitro", handleNitro);
    
// Пламя нитро за машиной
const flameMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6500,
  emissive: 0xff4500,
  emissiveIntensity: 2
});

const flameGeometry = new THREE.ConeGeometry(0.18, 0.9, 8);

const flames: THREE.Mesh[] = [];

for (const x of [-0.5, 0.5]) {
  const flame = new THREE.Mesh(flameGeometry, flameMaterial);
  flame.rotation.x = Math.PI / 2;
  flame.position.set(x, 0.65, 2.35);
  flame.visible = false;
  car.add(flame);
  flames.push(flame);
}

    scene.add(car);
  // Управление: руль задаёт угол поворота машины, а не сдвигает её вбок
let steeringTargetX = 0;
let steeringVisual = 0;

const handleSteer = (event: Event) => {
  const customEvent = event as CustomEvent<number>;
  steeringTargetX = THREE.MathUtils.clamp(customEvent.detail / 4, -1, 1);
};

window.addEventListener("turbo-steer", handleSteer);

    // Чёрный контур кузова
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x07111c })
    );
    outline.position.copy(body.position);
    car.add(outline);
    const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "ArrowLeft" || event.key === "a") {
    steeringTargetX = -1;
  }

  if (event.key === "ArrowRight" || event.key === "d") {
    steeringTargetX = 1;
  }
  if (event.key === "ArrowUp" || event.key === "w") {
    steeringTargetX *= 0.65;
  }
};
const handleKeyUp = (event: KeyboardEvent) => {
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(event.key)) {
    steeringTargetX = 0;
  }
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);

    let animationId = 0;

    const animate = () => {
  animationId = requestAnimationFrame(animate);

  
  // Плавный отклик руля и небольшой наклон кузова в повороте
  steeringVisual += (steeringTargetX - steeringVisual) * 0.14;
  car.rotation.y = baseHeading - steeringVisual * 0.32;
  car.rotation.z = -steeringVisual * 0.045;

  // Показываем пульсирующее пламя при активном нитро
  flames.forEach((flame, index) => {
    flame.visible = nitroActive;

    if (nitroActive) {
      const pulse = 1 + Math.sin(Date.now() * 0.02 + index) * 0.25;
      flame.scale.set(1, pulse, 1);
    } else {
      flame.scale.set(1, 1, 1);
    }
  });

  renderer.render(scene, camera);
};

    animate();

    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener("resize", resize);

    return () => {
  window.removeEventListener("turbo-steer", handleSteer);
  window.removeEventListener("turbo-nitro", handleNitro);
  cancelAnimationFrame(animationId);
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("resize", resize);
  renderer.dispose();
  mount.removeChild(renderer.domElement);
};
}, [cameraMode]);

  
return (
  <div style={{ width: "100%", position: "relative" }}>
    <div
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 3,
        display: "flex",
        gap: "8px"
      }}
    >
      <button onClick={() => setCameraMode("top")}>
        TOP VIEW
      </button>

      <button onClick={() => setCameraMode("angle")}>
        ANGLE VIEW
      </button>
    </div>

  
    {/* Мини-карта извилистой трассы */}
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 3,
        width: "112px",
        height: "142px",
        padding: "7px",
        borderRadius: "12px",
        background: "rgba(8, 15, 25, 0.82)",
        border: "1px solid rgba(255,255,255,0.35)",
        boxShadow: "0 4px 14px #0008",
        pointerEvents: "none"
      }}
    >
      <div style={{ color: "#dceaf5", fontSize: "9px", fontWeight: 900, letterSpacing: "1px", marginBottom: "3px" }}>
        TRACK MAP
      </div>
      <svg viewBox="0 0 100 112" width="100%" height="112" aria-label="Мини-карта трассы">
        <path d="M 48 4 C 18 17, 78 27, 49 43 S 18 66, 49 78 S 82 96, 52 108"
          fill="none" stroke="#111923" strokeWidth="19" strokeLinecap="round" />
        <path d="M 48 4 C 18 17, 78 27, 49 43 S 18 66, 49 78 S 82 96, 52 108"
          fill="none" stroke="#d8d2c8" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 48 4 C 18 17, 78 27, 49 43 S 18 66, 49 78 S 82 96, 52 108"
          fill="none" stroke="#f4f0df" strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="49" cy="78" r="4.5" fill="#36c5f0" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    </div>

    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "500px",
        overflow: "hidden",
        borderRadius: "16px"
      }}
    />

    {/* Нижняя панель управления */}
    <div
      style={{
        position: "absolute",
        bottom: "18px",
        left: 0,
        right: 0,
        height: "112px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none"
      }}
    >
      {/* Виртуальный руль */}
     
{/* Реалистичный спортивный руль */}
<div
  onPointerDown={(event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }}
  onPointerMove={(event) => {
    if (event.buttons === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const value = ((event.clientX - center) / (rect.width / 2)) * 4;
    setSteeringAngle(value * 35);

    window.dispatchEvent(
      new CustomEvent("turbo-steer", {
        detail: Math.max(-4, Math.min(4, value))
      })
    );
  }}
  onPointerUp={() => {setSteeringAngle(0);
    window.dispatchEvent(
      new CustomEvent("turbo-steer", { detail: 0 })
    );
  }}
  onPointerCancel={() => {setSteeringAngle(0);
    window.dispatchEvent(
      new CustomEvent("turbo-steer", { detail: 0 })
    );
  }}
  style={{
    transform: `rotate(${steeringAngle}deg)`,
    transition: "transform 0.12s ease-out",
    width: "116px",
    height: "116px",
    borderRadius: "50%",
    position: "relative",
    background: "radial-gradient(circle, #303d4d 0%, #111923 68%, #05080d 100%)",
    border: "9px solid #171e29",
    boxShadow: "0 0 0 3px #aebdca, 0 6px 18px #000b, inset 0 0 12px #000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    touchAction: "none"
  }}
>
  {/* Верхняя голубая метка */}
  <div style={{
    position: "absolute",
    top: "-8px",
    width: "12px",
    height: "17px",
    background: "#36c5f0",
    borderRadius: "4px"
  }} />

  {/* Левая спица */}
  <div style={{
    position: "absolute",
    width: "38px",
    height: "11px",
    background: "linear-gradient(#dce7ef, #657889)",
    left: "7px",
    top: "56px",
    transform: "rotate(25deg)",
    borderRadius: "5px"
  }} />

  {/* Правая спица */}
  <div style={{
    position: "absolute",
    width: "38px",
    height: "11px",
    background: "linear-gradient(#dce7ef, #657889)",
    right: "7px",
    top: "56px",
    transform: "rotate(-25deg)",
    borderRadius: "5px"
  }} />

  {/* Нижняя спица */}
  <div style={{
    position: "absolute",
    width: "13px",
    height: "35px",
    background: "linear-gradient(90deg, #718596, #e1eaf0, #718596)",
    bottom: "3px",
    borderRadius: "5px"
  }} />

  {/* Центральная ступица */}
  <div style={{
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%, #42566b, #101722 75%)",
    border: "3px solid #a9bbc9",
    boxShadow: "0 2px 8px #000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#36c5f0",
    fontSize: "12px",
    fontWeight: "900",
    zIndex: 1
  }}>
    TR
  </div>
</div>

      {/* Кнопка нитро */}
      <button
        onPointerDown={() => {
  window.dispatchEvent(new CustomEvent("turbo-nitro", {
    detail: true
  }));
}}
onPointerUp={() => {
  window.dispatchEvent(new CustomEvent("turbo-nitro", {
    detail: false
  }));
}}
onPointerLeave={() => {
  window.dispatchEvent(new CustomEvent("turbo-nitro", {
    detail: false
  }));
}}
onPointerCancel={() => {
  window.dispatchEvent(new CustomEvent("turbo-nitro", {
    detail: false
  }));
}}
        style={{
          position: "absolute",
          right: "18px",
          bottom: "8px",
          width: "76px",
          height: "76px",
          borderRadius: "50%",
          border: "3px solid #ffbd62",
          background: "linear-gradient(145deg, #ff9d32, #e94b16)",
          color: "white",
          fontSize: "14px",
          fontWeight: "900",
          boxShadow: "0 4px 18px #ff641888",
          pointerEvents: "auto",
          touchAction: "none"
        }}
      >
        ⚡ NITRO
      </button>
    </div>
  </div>
);
}
