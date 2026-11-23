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

  // Sculpted street-racer body: tapered nose, wide shoulders and a muscular rear.
  // The beveled plan-view extrusion replaces the old rectangular body block.
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.82, 2.05);
  bodyShape.lineTo(0.82, 2.05);
  bodyShape.lineTo(1.02, 1.55);
  bodyShape.lineTo(1.08, 0.82);
  bodyShape.lineTo(1.03, -1.22);
  bodyShape.lineTo(0.88, -1.88);
  bodyShape.lineTo(0.64, -2.12);
  bodyShape.lineTo(-0.64, -2.12);
  bodyShape.lineTo(-0.88, -1.88);
  bodyShape.lineTo(-1.03, -1.22);
  bodyShape.lineTo(-1.08, 0.82);
  bodyShape.lineTo(-1.02, 1.55);
  bodyShape.closePath();
  const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.62, bevelEnabled: true, bevelSegments: 3,
    steps: 1, bevelSize: 0.1, bevelThickness: 0.1, curveSegments: 4
  });
  bodyGeometry.translate(0, 0, -0.31);
  bodyGeometry.rotateX(Math.PI / 2);
  bodyGeometry.computeVertexNormals();
  // Subtle model-specific body proportions create five distinct silhouettes.
  const bodyWidthScales = [0.94, 0.98, 1.02, 1.06, 1.1];
  const bodyLengthScales = [0.96, 1.02, 1.06, 1.1, 1.14];
  bodyGeometry.scale(bodyWidthScales[model] ?? 1, 1, bodyLengthScales[model] ?? 1);
  const bodyOutline = new THREE.Mesh(bodyGeometry, new THREE.MeshBasicMaterial({
    color: 0x10131b, side: THREE.BackSide
  }));
  bodyOutline.scale.setScalar(1.035);
  bodyOutline.position.y = 0.79;
  group.add(bodyOutline);
  const body = new THREE.Mesh(bodyGeometry, paint);
  body.position.y = 0.79;
  group.add(body);
  // Model-specific cabin silhouettes: compact roof, sport coupe, or low supercar canopy.
  const cabinWidths = [1.52, 1.58, 1.62, 1.66, 1.7];
  const cabinHeights = [0.68, 0.7, 0.66, 0.62, 0.58];
  const cabinLengths = [1.92, 2.02, 2.08, 2.14, 2.2];
  addOutlinedBox(
    cabinWidths[model] ?? 1.62,
    cabinHeights[model] ?? 0.68,
    cabinLengths[model] ?? 2.05,
    glass,
    new THREE.Vector3(0, 1.38 + (model >= 3 ? -0.035 : 0), -0.18),
    1.035
  );
  const roofWidths = [1.48, 1.52, 1.55, 1.58, 1.62];
  const roofLengths = [1.22, 1.3, 1.36, 1.42, 1.48];
  addOutlinedBox(
    roofWidths[model] ?? 1.55,
    0.12,
    roofLengths[model] ?? 1.36,
    paint,
    new THREE.Vector3(0, 1.76 + (model >= 3 ? -0.035 : 0), -0.22),
    1.06
  );
  // Individual side windows and front/rear glass give each cabin a clearer profile.
  const sideWindowLengths = [0.88, 0.96, 1.02, 1.08, 1.14];
  const sideWindowHeights = [0.25, 0.27, 0.28, 0.29, 0.3];
  for (const side of [-1, 1]) {
    addOutlinedBox(
      0.025,
      sideWindowHeights[model] ?? 0.28,
      sideWindowLengths[model] ?? 1.02,
      glass,
      new THREE.Vector3(side * ((cabinWidths[model] ?? 1.62) / 2 + 0.012), 1.43, -0.18),
      1.025
    );
  }
  addOutlinedBox(
    (cabinWidths[model] ?? 1.62) * 0.72,
    0.025,
    0.28,
    glass,
    new THREE.Vector3(0, 1.45, -1.16),
    1.02
  );
  addOutlinedBox(
    (cabinWidths[model] ?? 1.62) * 0.68,
    0.025,
    0.26,
    glass,
    new THREE.Vector3(0, 1.44, 0.8),
    1.02
  );

  const wheelGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.38, 20);
  const rimGeometry = new THREE.CylinderGeometry(0.315, 0.315, 0.395, 20);
  const rimColors = [0xb8c4d2, 0xffd044, 0xb58aff, 0xff526d, 0xe8f2ff];
  const rimColor = rimColors[model] ?? 0xd8e2ec;
  const spokeCounts = [8, 10, 5, 6, 7];
  const spokeCount = spokeCounts[model] ?? 10;
  const spokeMaterial = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.82, roughness: 0.24 });
  const brakeDiscMaterial = new THREE.MeshStandardMaterial({ color: 0x596575, metalness: 0.72, roughness: 0.42 });
  const brakeDiscRadii = [0.29, 0.3, 0.315, 0.33, 0.345];
  const brakeDiscRadius = brakeDiscRadii[model] ?? 0.315;
  const caliperColors = [0xffd044, 0xff9d36, 0xb58aff, 0xff354f, 0xe8f2ff];
  const caliperMaterial = new THREE.MeshToonMaterial({ color: caliperColors[model] ?? 0xff594f });
  const caliperSizes = [0.16, 0.18, 0.2, 0.22, 0.24];
  for (const x of [-1.12, 1.12]) for (const z of [-1.28, 1.28]) {
    const wheel = new THREE.Mesh(wheelGeometry, rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.48, z);
    group.add(wheel);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(brakeDiscRadius, brakeDiscRadius, 0.035, 24), brakeDiscMaterial);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(x * 0.91, 0.48, z);
    group.add(disc);

    const rim = new THREE.Mesh(rimGeometry, dark);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x * 1.012, 0.48, z);
    group.add(rim);

    // Ten sculpted spokes and a bright center lock make each wheel read as a performance alloy.
    for (let spokeIndex = 0; spokeIndex < 10; spokeIndex++) {
      const angle = (spokeIndex / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.255, 0.075), spokeMaterial);
      spoke.position.set(x * 1.045, 0.48 + Math.cos(angle) * 0.17, z + Math.sin(angle) * 0.17);
      spoke.rotation.x = -angle;
      group.add(spoke);
    }

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.42, 12), metal);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x * 1.055, 0.48, z);
    group.add(hub);

    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, caliperSizes[model] ?? 0.2, 0.14), caliperMaterial);
    caliper.position.set(x * 0.93, 0.59, z + 0.22);
    group.add(caliper);
  }

  // Model-specific wide fenders: progressively broader arches and outer flare lips.
  const archRadii = [0.52, 0.535, 0.55, 0.565, 0.58];
  const archOutlineTubes = [0.125, 0.135, 0.145, 0.155, 0.165];
  const archPaintTubes = [0.075, 0.08, 0.085, 0.09, 0.095];
  const flareOffsets = [0.035, 0.045, 0.055, 0.065, 0.075];
  for (const x of [-1.12, 1.12]) for (const z of [-1.28, 1.28]) {
    const archRadius = archRadii[model] ?? 0.55;
    const flareOffset = flareOffsets[model] ?? 0.055;
    const archOutline = new THREE.Mesh(
      new THREE.TorusGeometry(archRadius, archOutlineTubes[model] ?? 0.145, 8, 24, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x10131b })
    );
    archOutline.rotation.y = Math.PI / 2;
    archOutline.position.set(x * (1.035 + flareOffset), 0.48, z);
    group.add(archOutline);

    const archPaint = new THREE.Mesh(
      new THREE.TorusGeometry(archRadius, archPaintTubes[model] ?? 0.085, 8, 24, Math.PI),
      paint
    );
    archPaint.rotation.y = Math.PI / 2;
    archPaint.position.set(x * (1.065 + flareOffset), 0.48, z);
    group.add(archPaint);

    const flareLip = new THREE.Mesh(
      new THREE.TorusGeometry(archRadius + 0.035, 0.025 + model * 0.004, 6, 24, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x171d28 })
    );
    flareLip.rotation.y = Math.PI / 2;
    flareLip.position.set(x * (1.095 + flareOffset), 0.48, z);
    group.add(flareLip);
  }

  addOutlinedBox(2.28, 0.2, 0.28, dark, new THREE.Vector3(0, 0.48, -2.08));
  // Each garage model gets its own rear-wing profile, from subtle street spoiler to wide track wing.
  const wingWidths = [1.85, 2.05, 2.25, 2.48, 2.72];
  const wingHeights = [0.98, 1.04, 1.1, 1.16, 1.22];
  const wingWidth = wingWidths[model] ?? 2.25;
  const wingHeight = wingHeights[model] ?? 1.1;
  addOutlinedBox(wingWidth, 0.12, 0.38, dark, new THREE.Vector3(0, wingHeight, 1.75));
  for (const x of [-wingWidth * 0.34, wingWidth * 0.34]) {
    addOutlinedBox(0.12, wingHeight - 0.7, 0.12, dark, new THREE.Vector3(x, (wingHeight + 0.7) / 2, 1.72), 1.08);

    // Model-specific headlight shapes: slim street LEDs to wide supercar light blades.
    const headlightWidths = [0.52, 0.58, 0.62, 0.68, 0.72];
    const headlightHeights = [0.2, 0.18, 0.16, 0.14, 0.13];
    const ledColors = [0x54eaff, 0xffd044, 0xb58aff, 0xff526d, 0xe8f2ff];
    const lampWidth = headlightWidths[model] ?? 0.62;
    const lampHeight = headlightHeights[model] ?? 0.16;
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(lampWidth + 0.12, lampHeight + 0.1, 0.12),
      new THREE.MeshToonMaterial({ color: 0x101a29 })
    );
    housing.position.set(x * 0.9, 0.91, -2.13);
    group.add(housing);

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(lampWidth, lampHeight, 0.055),
      new THREE.MeshBasicMaterial({ color: 0xfff4cf })
    );
    lamp.position.set(x * 0.9, 0.94, -2.205);
    group.add(lamp);

    const ledAccent = new THREE.Mesh(
      new THREE.BoxGeometry(lampWidth * 0.78, 0.035, 0.035),
      new THREE.MeshBasicMaterial({ color: ledColors[model] ?? 0x54eaff })
    );
    ledAccent.position.set(x * 0.9, 0.855, -2.21);
    group.add(ledAccent);
  }

  // Wide central grille and sculpted lower air intakes give the nose a race-ready face.
  addOutlinedBox(0.92, 0.25, 0.1, dark, new THREE.Vector3(0, 0.68, -2.16), 1.08);
  for (const x of [-0.78, 0.78]) {
    addOutlinedBox(0.34, 0.2, 0.1, dark, new THREE.Vector3(x, 0.53, -2.17), 1.06);
  }

  // Bold comic-style hood stripes and front splitter
  const hoodAccentColors = [0x36c5f0, 0xffc629, 0x9b55ff, 0xff354f, 0xe8f2ff];
  const hoodAccentColor = hoodAccentColors[model] ?? 0xffffff;
  const hoodStripeWidth = [0.09, 0.12, 0.15, 0.1, 0.18][model] ?? 0.12;
  const hoodStripeXs = model === 1 ? [-0.42, 0.42] : model === 3 ? [-0.3, 0.3] : [-0.36, 0.36];
  for (const x of hoodStripeXs) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(hoodStripeWidth, 0.028, model === 4 ? 1.28 : 1.12),
      new THREE.MeshBasicMaterial({ color: hoodAccentColor })
    );
    stripe.position.set(x, 1.153, -1.28);
    group.add(stripe);
  }
  if (model === 2 || model === 4) {
    for (const x of [-0.16, 0.16]) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.035, 0.38),
        new THREE.MeshStandardMaterial({ color: 0x171d28, roughness: 0.72 })
      );
      vent.position.set(x, 1.16, -1.12);
      group.add(vent);
    }
  }
    // Model-specific front bumper shapes: layered lower fascia and corner canards.
  const bumperWidths = [1.72, 1.86, 2.02, 2.18, 2.32];
  const bumperHeights = [0.16, 0.18, 0.2, 0.22, 0.24];
  const bumperColors = [0x36c5f0, 0xffc629, 0x9b55ff, 0xff354f, 0xe8f2ff];
  addOutlinedBox(
    bumperWidths[model] ?? 2.02,
    bumperHeights[model] ?? 0.2,
    0.16,
    dark,
    new THREE.Vector3(0, 0.62, -2.08),
    1.045
  );
  for (const x of [-1, 1]) {
    const canard = new THREE.Mesh(
      new THREE.BoxGeometry(model >= 3 ? 0.42 : 0.3, 0.055, 0.22 + model * 0.025),
      new THREE.MeshBasicMaterial({ color: bumperColors[model] ?? 0xffffff })
    );
    canard.position.set(x * (0.78 + model * 0.055), 0.56, -2.17);
    canard.rotation.y = x * -0.16;
    group.add(canard);
  }
  const lowerIntake = new THREE.Mesh(
    new THREE.BoxGeometry(0.48 + model * 0.12, 0.075, 0.025),
    new THREE.MeshBasicMaterial({ color: 0x101722 })
  );
  lowerIntake.position.set(0, 0.64, -2.17);
  group.add(lowerIntake);

// Model-specific front splitters: wider and deeper on higher-tier cars.
  const splitterWidths = [2.18, 2.32, 2.48, 2.66, 2.82];
  const splitterDepths = [0.22, 0.25, 0.28, 0.32, 0.36];
  addOutlinedBox(
    splitterWidths[model] ?? 2.48,
    0.13,
    splitterDepths[model] ?? 0.28,
    dark,
    new THREE.Vector3(0, 0.43, -2.18),
    1.035
  );

  // Model-specific side skirts give each car a distinct lower-body profile.
  const skirtWidths = [0.14, 0.16, 0.18, 0.2, 0.22];
  const skirtHeights = [0.16, 0.18, 0.2, 0.22, 0.24];
  const skirtLengths = [2.05, 2.2, 2.35, 2.5, 2.62];
  for (const x of [-1.08, 1.08]) {
    addOutlinedBox(
      skirtWidths[model] ?? 0.18,
      skirtHeights[model] ?? 0.2,
      skirtLengths[model] ?? 2.35,
      dark,
      new THREE.Vector3(x, 0.43, 0.05),
      1.06
    );
  }
  // Model-specific side air intakes: larger openings and more louvers on higher-tier cars.
  const sideVentLengths = [0.34, 0.42, 0.5, 0.58, 0.66];
  const sideVentHeights = [0.18, 0.2, 0.22, 0.24, 0.26];
  const sideVentLouverCounts = [2, 2, 3, 3, 4];
  const sideVentColors = [0x35e5ff, 0xffd044, 0xb58aff, 0xff526d, 0xf4f7ff];
  for (const side of [-1, 1]) {
    const ventLength = sideVentLengths[model] ?? 0.5;
    const ventHeight = sideVentHeights[model] ?? 0.22;
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, ventHeight, ventLength),
      new THREE.MeshToonMaterial({ color: 0x101722 })
    );
    vent.position.set(side * 1.115, 0.78, 0.48);
    group.add(vent);
    const ventAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.025, ventLength * 0.82),
      new THREE.MeshBasicMaterial({ color: sideVentColors[model] ?? 0xffffff })
    );
    ventAccent.position.set(side * 1.15, 0.78 + ventHeight * 0.42, 0.48);
    group.add(ventAccent);
    const louverCount = sideVentLouverCounts[model] ?? 3;
    for (let louver = 0; louver < louverCount; louver++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.025, ventLength * 0.72),
        new THREE.MeshStandardMaterial({ color: 0x66717e, metalness: 0.55, roughness: 0.42 })
      );
      slat.position.set(side * 1.153, 0.78 - ventHeight * 0.28 + louver * (ventHeight * 0.22), 0.48);
      group.add(slat);
    }
  }

  // A distinct side graphic gives every garage car its own visual identity.
  const sideAccentColors = [0x35e5ff, 0xffd044, 0xb58aff, 0xff526d, 0xf4f7ff];
  const sideAccent = new THREE.MeshBasicMaterial({ color: sideAccentColors[model] ?? 0x35e5ff });
  for (const x of [-1.105, 1.105]) {
    const graphic = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.095, 1.18), sideAccent);
    graphic.position.set(x, 0.91, 0.18);
    group.add(graphic);
    const rearMark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.34), sideAccent);
    rearMark.position.set(x, 0.92, 1.18);
    group.add(rearMark);
  }
  addOutlinedBox(1.45, 0.12, 0.42, dark, new THREE.Vector3(0, 0.42, 2.12));

    // Model-specific rear bumper diffuser: wider lower valance and colored corner fins.
  const rearValanceWidths = [1.62, 1.78, 1.94, 2.1, 2.26];
  const rearValanceHeights = [0.14, 0.16, 0.18, 0.2, 0.22];
  const rearAccentColors = [0x36c5f0, 0xffc629, 0x9b55ff, 0xff354f, 0xe8f2ff];
  addOutlinedBox(
    rearValanceWidths[model] ?? 1.94,
    rearValanceHeights[model] ?? 0.18,
    0.16,
    dark,
    new THREE.Vector3(0, 0.49, 2.12),
    1.045
  );
  for (const x of [-1, 1]) {
    const rearFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.28 + model * 0.025, 0.2 + model * 0.025),
      new THREE.MeshBasicMaterial({ color: rearAccentColors[model] ?? 0xffffff })
    );
    rearFin.position.set(x * (0.68 + model * 0.07), 0.43, 2.19);
    group.add(rearFin);
  }

// Model-specific rear lighting: compact lamps, wide light bars, and colored LED signatures.
  const rearLampWidths = [0.4, 0.46, 0.52, 0.58, 0.64];
  const rearLampHeights = [0.11, 0.095, 0.085, 0.075, 0.07];
  const rearLedColors = [0xff334d, 0xffb52e, 0xb58aff, 0xff526d, 0xe8f2ff];
  addOutlinedBox(1.72 + model * 0.08, 0.2, 0.12, dark, new THREE.Vector3(0, 0.99, 2.13), 1.06);
  for (const x of [-0.66, 0.66]) {
    const tailLamp = new THREE.Mesh(
      new THREE.BoxGeometry(rearLampWidths[model] ?? 0.52, rearLampHeights[model] ?? 0.085, 0.055),
      new THREE.MeshBasicMaterial({ color: 0xff334d })
    );
    tailLamp.position.set(x, 1.0, 2.205);
    group.add(tailLamp);
    const rearLed = new THREE.Mesh(
      new THREE.BoxGeometry((rearLampWidths[model] ?? 0.52) * 0.82, 0.025, 0.025),
      new THREE.MeshBasicMaterial({ color: rearLedColors[model] ?? 0xff334d })
    );
    rearLed.position.set(x, 1.055, 2.21);
    group.add(rearLed);

    const exhaustRadii = [0.095, 0.11, 0.12, 0.135, 0.15];
    const exhaustLengths = [0.17, 0.19, 0.21, 0.23, 0.25];
    const exhaustColors = [0x9ba8b5, 0xd6a84b, 0x9d7be8, 0xc85a65, 0xe8f2ff];
    const exhaustRadius = exhaustRadii[model] ?? 0.12;
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(exhaustRadius, exhaustRadius * 1.22, exhaustLengths[model] ?? 0.21, 12),
      new THREE.MeshStandardMaterial({ color: exhaustColors[model] ?? 0x9ba8b5, metalness: 0.86, roughness: 0.22 })
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x * 1.22, 0.43, 2.28);
    group.add(exhaust);
  }
  // Model-specific diffuser fins: each car gets its own fin count and depth profile.
  const diffuserFinCounts = [3, 4, 5, 6, 7];
  const diffuserFinWidths = [0.09, 0.085, 0.08, 0.075, 0.07];
  const diffuserFinHeights = [0.17, 0.19, 0.21, 0.23, 0.25];
  const diffuserFinDepths = [0.22, 0.25, 0.28, 0.31, 0.34];
  const finCount = diffuserFinCounts[model] ?? 5;
  for (let fin = 0; fin < finCount; fin++) {
    const x = (fin - (finCount - 1) / 2) * (0.96 / Math.max(1, finCount - 1));
    addOutlinedBox(
      diffuserFinWidths[model] ?? 0.08,
      diffuserFinHeights[model] ?? 0.21,
      diffuserFinDepths[model] ?? 0.28,
      dark,
      new THREE.Vector3(x, 0.39, 2.16),
      1.04
    );
  }
  const diffuserTunnelWidths = [0.34, 0.4, 0.46, 0.52, 0.58];
  addOutlinedBox(
    diffuserTunnelWidths[model] ?? 0.46,
    0.075,
    0.34 + model * 0.025,
    new THREE.MeshBasicMaterial({ color: rearAccentColors[model] ?? 0xffffff }),
    new THREE.Vector3(0, 0.34, 2.18),
    1.02
  );

  group.scale.setScalar(model === 2 ? 0.94 : model === 4 ? 1.04 : 1);
  return group;
}

export default function Race3DPrototype({ carColor, carModel, onFinish }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls>({ left: false, right: false, throttle: true, brake: false, nitro: false });
  const finishRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [hud, setHud] = useState({ speed: 0, lap: 1, time: 0, position: 1, overtake: false, offroad: false, bumped: false, lapNotice: "", lapProgress: 0, nitro: 100 });
  const [finished, setFinished] = useState(false);
  const [countdown, setCountdown] = useState(3);

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

    // High-contrast comic checkered stripe marks the start and finish line
    const finishPoint = curve.getPointAt(0);
    const finishTangent = curve.getTangentAt(0).normalize();
    const finishSide = new THREE.Vector3(-finishTangent.z, 0, finishTangent.x).normalize();
    const finishYaw = Math.atan2(finishTangent.x, finishTangent.z);
    for (let tile = 0; tile < 14; tile++) {
      const checker = new THREE.Mesh(
        new THREE.BoxGeometry(1.02, 0.045, 0.82),
        new THREE.MeshBasicMaterial({ color: tile % 2 === 0 ? 0xffffff : 0x111722 })
      );
      const tilePosition = finishPoint.clone().addScaledVector(finishSide, -6.5 + tile * 1.0);
      checker.position.set(tilePosition.x, 0.19, tilePosition.z);
      checker.rotation.y = finishYaw;
      scene.add(checker);
    }

    // Comic-style start gantry with signal lamps above the start line
    const gantryMaterial = new THREE.MeshToonMaterial({ color: 0x202b3b });
    const gantryYaw = finishYaw;
    for (const sign of [-1, 1]) {
      const postPosition = finishPoint.clone().addScaledVector(finishSide, sign * 8.35);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.48, 5.8, 0.55), gantryMaterial);
      post.position.set(postPosition.x, 2.9, postPosition.z);
      post.rotation.y = gantryYaw;
      scene.add(post);
    }
    const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(17.1, 0.58, 0.72), gantryMaterial);
    gantryBeam.position.set(finishPoint.x, 5.65, finishPoint.z);
    gantryBeam.rotation.y = gantryYaw;
    scene.add(gantryBeam);
    const signalLamps = Array.from({ length: 5 }, (_, i) => {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3038 })
      );
      const lampPosition = finishPoint.clone().addScaledVector(finishSide, (i - 2) * 2.25);
      lamp.position.set(lampPosition.x, 5.08, lampPosition.z);
      scene.add(lamp);
      return lamp;
    });

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
    // Bright brake lights make braking readable to the player and rivals
    const brakeLights = [-0.72, 0.72].map(x => {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.17, 0.07),
        new THREE.MeshBasicMaterial({ color: 0x641b25 })
      );
      light.position.set(x, 0.91, 2.105);
      player.add(light);
      return light;
    });
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
    const nitroTrails = [-0.72, 0.72].map(x => {
      const trail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.08, 2.6),
        new THREE.MeshBasicMaterial({ color: 0x35dcff, transparent: true, opacity: 0.82 })
      );
      trail.position.set(x, 0.55, 3.15);
      trail.visible = false;
      player.add(trail);
      return trail;
    });
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0xcbd5df, transparent: true, opacity: 0.32 });
    const smokePuffs = Array.from({ length: 10 }, () => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), smokeMaterial.clone());
      puff.visible = false;
      scene.add(puff);
      return { mesh: puff, life: 0 };
    });
    let smokeCursor = 0;

    // Small dirt puffs kick up when the player leaves the asphalt
    const dustParticles = Array.from({ length: 12 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xb58a55, transparent: true, opacity: 0 })
      );
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), life: 0 };
    });
    let dustCursor = 0;
    let dustTimer = 0;

    // Reusable fading tire marks appear during hard cornering
    const skidGeometry = new THREE.BoxGeometry(0.2, 0.018, 0.9);
    const skidMarks = Array.from({ length: 36 }, () => {
      const material = new THREE.MeshBasicMaterial({ color: 0x171b22, transparent: true, opacity: 0 });
      const mark = new THREE.Mesh(skidGeometry, material);
      mark.visible = false;
      scene.add(mark);
      return { mesh: mark, life: 0 };
    });
    let skidCursor = 0;
    let skidTimer = 0;

    // Brief comic sparks burst from the contact point when cars collide
    const sparkParticles = Array.from({ length: 18 }, (_, i) => {
      const material = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe36b : 0xff7138, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), material);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), life: 0 };
    });
    let sparkCursor = 0;

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
    let nitroCharge = 100;
    let elapsed = 0;
    let countdownElapsed = 0;
    let last = 0;
    let hudTimer = 0;
    let previousPosition = 1;
    let previousLap = 1;
    let lapNoticeUntil = 0;
    let overtakeUntil = 0;
    let bumpUntil = 0;
    let collisionCooldown = 0;
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
      signalLamps.forEach(lamp => {
        (lamp.material as THREE.MeshBasicMaterial).color.setHex(countdownElapsed >= 3 ? 0x45ff83 : 0xff3038);
      });
      let nitroBoostActive = false;
      if (!finishRef.current) {
        countdownElapsed += dt;
        const countdownActive = countdownElapsed < 3;
        const c = countdownActive
          ? { ...controlsRef.current, left: false, right: false, throttle: false, brake: false, nitro: false }
          : controlsRef.current;
        if (!countdownActive) elapsed += dt;
        nitroBoostActive = c.nitro && nitroCharge > 0;
        nitroCharge = THREE.MathUtils.clamp(nitroCharge + (nitroBoostActive ? -34 : 16) * dt, 0, 100);
        const maxSpeed = nitroBoostActive ? 0.115 : 0.082;
        const acceleration = c.brake ? -0.2 : c.throttle ? 0.105 : -0.035;
        speed = THREE.MathUtils.clamp(speed + acceleration * dt, 0, maxSpeed);
        brakeLights.forEach(light => {
          (light.material as THREE.MeshBasicMaterial).color.setHex(c.brake ? 0xff263f : 0x641b25);
        });
        const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        lateral = THREE.MathUtils.clamp(lateral + steer * (0.9 + speed * 8) * dt, -5.2, 5.2);
        const offroad = Math.abs(lateral) > 4.45;
        if (offroad) speed = Math.max(0, speed - dt * 0.075);
        nitroFlames.forEach((flame, i) => {
          flame.visible = nitroBoostActive && speed > 0.025;
          flame.scale.setScalar(flame.visible ? 0.78 + Math.random() * 0.48 : 0.001);
          flame.position.z = 2.42 + Math.random() * 0.18;
          flame.material = flame.material;
        });
        nitroTrails.forEach((trail, i) => {
          trail.visible = nitroBoostActive && speed > 0.025;
          trail.scale.z = trail.visible ? 0.75 + Math.random() * 0.65 : 0.001;
          trail.position.z = 2.85 + Math.random() * 0.45;
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
        dustTimer -= dt;
        if (offroad && speed > 0.018 && dustTimer <= 0) {
          const dust = dustParticles[dustCursor];
          dustCursor = (dustCursor + 1) % dustParticles.length;
          dust.life = 0.7;
          dust.mesh.visible = true;
          const rearWheel = player.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.28, 1.55));
          dust.mesh.position.copy(rearWheel);
          dust.mesh.scale.setScalar(0.65 + Math.random() * 0.55);
          dust.velocity.set((Math.random() - 0.5) * 1.8, 0.7 + Math.random() * 1.2, 0.4 + Math.random() * 1.2);
          (dust.mesh.material as THREE.MeshBasicMaterial).opacity = 0.48;
          dustTimer = 0.075;
        }
        dustParticles.forEach(dust => {
          if (dust.life <= 0) return;
          dust.life -= dt;
          dust.velocity.y -= dt * 1.8;
          dust.mesh.position.addScaledVector(dust.velocity, dt);
          dust.mesh.scale.multiplyScalar(1 + dt * 0.8);
          (dust.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, dust.life / 0.7) * 0.48;
          if (dust.life <= 0) dust.mesh.visible = false;
        });
        skidTimer -= dt;
        if (Math.abs(steer) > 0 && speed > 0.045 && skidTimer <= 0) {
          for (const wheelSide of [-1, 1]) {
            const mark = skidMarks[skidCursor];
            skidCursor = (skidCursor + 1) % skidMarks.length;
            mark.life = 2.2;
            mark.mesh.visible = true;
            const rearWheel = player.localToWorld(new THREE.Vector3(wheelSide * 0.92, 0.13, 1.48));
            mark.mesh.position.set(rearWheel.x, 0.13, rearWheel.z);
            mark.mesh.rotation.y = player.rotation.y;
            (mark.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42;
          }
          skidTimer = 0.09;
        }
        skidMarks.forEach(mark => {
          if (mark.life <= 0) return;
          mark.life -= dt;
          (mark.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, mark.life / 2.2) * 0.42;
          if (mark.life <= 0) mark.mesh.visible = false;
        });
        progress += speed * dt;
        const currentLap = Math.min(totalLaps, Math.floor(progress) + 1);
        if (currentLap > previousLap && currentLap <= totalLaps) lapNoticeUntil = elapsed + 1.8;
        previousLap = currentLap;
        if (progress >= totalLaps) {
          finishRef.current = true;
          setFinished(true);
          onFinishRef.current(Math.max(100, Math.round(1200 - elapsed * 4)));
        }
        hudTimer += dt;
        if (hudTimer > 0.12) {
          const position = 1 + rivalProgress.filter(rival => rival > progress).length;
          if (position < previousPosition) overtakeUntil = elapsed + 1.6;
          previousPosition = position;
          setCountdown(countdownElapsed < 3 ? Math.max(1, Math.ceil(3 - countdownElapsed)) : countdownElapsed < 3.65 ? 0 : -1);
          setHud({
            speed: Math.round(speed * 1500),
            lap: Math.min(totalLaps, Math.floor(progress) + 1),
            time: elapsed,
            position,
            overtake: elapsed < overtakeUntil,
            offroad,
            bumped: elapsed < bumpUntil,
            lapNotice: elapsed < lapNoticeUntil ? `LAP ${previousLap}!` : "",
            lapProgress: progress % 1,
            nitro: nitroCharge
          });
          hudTimer = 0;
        }
      }
      const t = progress % 1;
      placeCar(player, t, lateral);
      const impactWobble = Math.max(0, (bumpUntil - elapsed) / 0.65);
      player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, Math.sin(elapsed * 34) * 0.13 * impactWobble, 0.22);
      player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, Math.cos(elapsed * 29) * 0.045 * impactWobble, 0.2);
      const tangent = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const lookAhead = curve.getPointAt((t + 0.018) % 1);
      camera.position.lerp(new THREE.Vector3(player.position.x - tangent.x * 9, 25, player.position.z - tangent.z * 9 + 12), 0.075);
      const shake = Math.max(0, (bumpUntil - elapsed) / 0.65) * 0.28;
      camera.position.x += Math.sin(elapsed * 58) * shake;
      camera.position.y += Math.abs(Math.cos(elapsed * 58)) * shake * 0.45;
      const targetFov = nitroBoostActive && speed > 0.025 ? 57 : speed > 0.055 ? 52 : 48;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
      camera.updateProjectionMatrix();
      camera.lookAt(player.position.x + side.x * lateral * 0.12, 0, player.position.z + side.z * lateral * 0.12);
      rivals.forEach((rival, i) => {
        if (!finishRef.current && countdownElapsed >= 3) rivalProgress[i] += dt * (0.047 + i * 0.006);
        const laneChange = Math.sin(elapsed * (0.48 + i * 0.13) + i * 2.1) * 2.35;
        const gap = ((rivalProgress[i] - progress + 1.5) % 1) - 0.5;
        if (Math.abs(gap) < 0.012 && Math.abs(laneChange - lateral) < 2.1 && elapsed >= collisionCooldown) {
          speed = Math.max(0, speed - 0.018);
          lateral = THREE.MathUtils.clamp(lateral + (lateral <= laneChange ? -0.65 : 0.65), -5.2, 5.2);
          bumpUntil = elapsed + 0.65;
          collisionCooldown = elapsed + 0.7;
          const contact = player.position.clone().lerp(rival.position, 0.5);
          for (let particle = 0; particle < 9; particle++) {
            const spark = sparkParticles[sparkCursor];
            sparkCursor = (sparkCursor + 1) % sparkParticles.length;
            spark.life = 0.42 + Math.random() * 0.2;
            spark.mesh.visible = true;
            spark.mesh.position.copy(contact).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2));
            spark.velocity.set((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7);
            spark.mesh.scale.setScalar(0.65 + Math.random() * 0.8);
            (spark.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
          }
        }
        placeCar(rival, rivalProgress[i], laneChange);
      });
      sparkParticles.forEach(spark => {
        if (spark.life <= 0) return;
        spark.life -= dt;
        spark.velocity.y -= dt * 9;
        spark.mesh.position.addScaledVector(spark.velocity, dt);
        spark.mesh.rotation.x += dt * 12;
        spark.mesh.rotation.y += dt * 15;
        (spark.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, spark.life / 0.62);
        if (spark.life <= 0) spark.mesh.visible = false;
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
        streak.scale.z = nitroBoostActive ? 1.8 : 1;
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
      <span>LAP {hud.lap}/3</span><span>{hud.lap === 3 ? "FINAL LAP" : `${3 - hud.lap} LAPS LEFT`}</span><span>POS {hud.position}/4</span><span>{hud.speed} KM/H</span><span>{hud.time.toFixed(1)}s</span>
    </div>
    {countdown >= 0 && !finished && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: countdown === 0 ? "#ffe05b" : "#fff", fontSize: countdown === 0 ? 58 : 76, fontWeight: 1000, fontStyle: "italic", letterSpacing: 3, textShadow: "4px 5px 0 #152033, -2px -2px 0 #152033" }}>{countdown === 0 ? "GO!" : countdown}</div>}
    <div style={{ position: "absolute", top: 34, left: 12, right: 12, height: 6, borderRadius: 8, overflow: "hidden", background: "rgba(10,20,32,.58)", border: "1px solid rgba(255,255,255,.55)" }}><div style={{ width: `${hud.lapProgress * 100}%`, height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#20d9ff,#ffe05b)", transition: "width 120ms linear" }} /></div>
    <div style={{ position: "absolute", top: 45, left: 12, right: 12, height: 5, borderRadius: 8, overflow: "hidden", background: "rgba(10,20,32,.58)" }}><div style={{ width: `${hud.nitro}%`, height: "100%", background: "linear-gradient(90deg,#168bff,#55f2ff)", transition: "width 120ms linear" }} /></div>
    {hud.overtake && !finished && <div style={{ position: "absolute", top: 54, left: 0, right: 0, textAlign: "center", color: "#ffe05b", fontSize: 24, fontWeight: 1000, fontStyle: "italic", letterSpacing: 2, textShadow: "2px 3px 0 #152033, -1px -1px 0 #152033" }}>OVERTAKE!</div>}
    {hud.offroad && !finished && <div style={{ position: "absolute", top: 84, left: 0, right: 0, textAlign: "center", color: "#ff9b42", fontSize: 18, fontWeight: 1000, fontStyle: "italic", letterSpacing: 1, textShadow: "2px 3px 0 #152033" }}>OFF TRACK! SLOW DOWN</div>}
    {hud.bumped && !finished && <div style={{ position: "absolute", top: 112, left: 0, right: 0, textAlign: "center", color: "#ff6b52", fontSize: 22, fontWeight: 1000, fontStyle: "italic", letterSpacing: 2, textShadow: "2px 3px 0 #152033" }}>BUMP!</div>}
    {hud.lapNotice && !finished && <div style={{ position: "absolute", top: "42%", left: 0, right: 0, textAlign: "center", color: "#ffffff", fontSize: 42, fontWeight: 1000, fontStyle: "italic", letterSpacing: 3, textShadow: "4px 5px 0 #152033, -2px -2px 0 #152033" }}>{hud.lapNotice}</div>}
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