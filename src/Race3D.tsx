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
  camera.position.set(0, 24, 3);
  camera.lookAt(0, 0, 0);
} else {
  // Сверху под углом
  camera.position.set(0, 12, 16);
  camera.lookAt(0, 0, 0);
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

    // Дорога
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.2, 100),
      new THREE.MeshStandardMaterial({ color: 0x303038 })
    );
    road.position.z = -35;
    road.receiveShadow = true;
    scene.add(road);

    // Разметка
    for (let z = -80; z < 10; z += 8) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 3),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      line.position.set(0, 0.13, z);
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
    scene.add(car);

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
  cancelAnimationFrame(animationId);
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("resize", resize);
  renderer.dispose();
  mount.removeChild(renderer.domElement);
};

  
return (
  <div style={{ width: "100%", position: "relative" }}>
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 2,
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

    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "500px",
        overflow: "hidden",
        borderRadius: "16px"
      }}
    />
  </div>
);
}
