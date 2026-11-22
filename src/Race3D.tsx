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

    // Извилистая трасса: плавные S-образные повороты
    const trackCenterX = (z: number) =>
      5 * Math.sin((z - 4) * 0.045) + 1.5 * Math.sin((z - 4) * 0.1);
    const trackSlope = (z: number) =>
      5 * 0.045 * Math.cos((z - 4) * 0.045) +
      1.5 * 0.1 * Math.cos((z - 4) * 0.1);
    const roadSegments = 180;
    const roadHalfWidth = 6;
    const roadVertices = new Float32Array((roadSegments + 1) * 2 * 3);
    const roadIndices: number[] = [];
    const leftEdge: THREE.Vector3[] = [];
    const rightEdge: THREE.Vector3[] = [];

    for (let i = 0; i <= roadSegments; i++) {
      const z = -90 + (110 * i) / roadSegments;
      const centerX = trackCenterX(z);
      const slope = trackSlope(z);
      const normalLength = Math.sqrt(1 + slope * slope);
      const normalX = 1 / normalLength;
      const normalZ = -slope / normalLength;
      const left = new THREE.Vector3(
        centerX - normalX * roadHalfWidth, 0.02, z - normalZ * roadHalfWidth
      );
      const right = new THREE.Vector3(
        centerX + normalX * roadHalfWidth, 0.02, z + normalZ * roadHalfWidth
      );
      leftEdge.push(left);
      rightEdge.push(right);
      const offset = i * 6;
      roadVertices[offset] = left.x;
      roadVertices[offset + 1] = left.y;
      roadVertices[offset + 2] = left.z;
      roadVertices[offset + 3] = right.x;
      roadVertices[offset + 4] = right.y;
      roadVertices[offset + 5] = right.z;
      if (i < roadSegments) {
        const a = i * 2;
        roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const roadGeometry = new THREE.BufferGeometry();
    roadGeometry.setAttribute("position", new THREE.BufferAttribute(roadVertices, 3));
    roadGeometry.setIndex(roadIndices);
    roadGeometry.computeVertexNormals();
    const road = new THREE.Mesh(
      roadGeometry,
      new THREE.MeshStandardMaterial({ color: 0x303038, side: THREE.DoubleSide })
    );
    road.receiveShadow = true;
    scene.add(road);

    // Светлые линии по краям асфальта
    [leftEdge, rightEdge].forEach((points) => {
      const edge = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xd7d2c8 })
      );
      edge.position.y = 0.08;
      scene.add(edge);
    });

    // Пунктирная центральная разметка повторяет изгибы дороги
    for (let z = -86; z < 16; z += 8) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 3),
        new THREE.MeshBasicMaterial({ color: 0xf5f0df })
      );
      line.position.set(trackCenterX(z), 0.13, z);
      line.rotation.y = Math.atan(trackSlope(z));
      scene.add(line);
    }

    // Земля
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(200, 0.1, 120),
      new THREE.MeshStandardMaterial({ color: 0x36a852 })
    );
    ground.position.set(0, -0.2, -35);
    scene.add(ground);

    // Машина
    const car = new THREE.Group();
    const carRef = { current: car };

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.7, 4),
      new THREE.MeshStandardMaterial({
        color: carColor,
        roughness: 0.35
      })
    );
    body.position.y = 0.8;
    body.castShadow = true;
    car.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.75, 1.8),
      new THREE.MeshStandardMaterial({
        color: 0x142b42,
        roughness: 0.2
      })
    );
    cabin.position.set(0, 1.45, -0.25);
    car.add(cabin);

    // Колёса
    for (const x of [-1.1, 1.1]) {
      for (const z of [-1.25, 1.25]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.25, 16),
          new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.5, z);
        car.add(wheel);
      }
    }

    car.position.set(0, 0, 4);
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
  // Управление поворотом от виртуального руля
let steeringTargetX = 0;

const handleSteer = (event: Event) => {
  const customEvent = event as CustomEvent<number>;
  steeringTargetX = THREE.MathUtils.clamp(customEvent.detail, -4, 4);
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
    car.position.x = Math.max(-4, car.position.x - 1);
  }

  if (event.key === "ArrowRight" || event.key === "d") {
    car.position.x = Math.min(4, car.position.x + 1);
  }
};

window.addEventListener("keydown", handleKeyDown);

    let animationId = 0;

    const animate = () => {
  animationId = requestAnimationFrame(animate);

  
  // Плавное движение машины за рулём
  car.position.x += (steeringTargetX - car.position.x) * 0.12;

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
