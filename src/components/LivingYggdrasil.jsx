import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const REALMS = [
  { color: '#81B88E', moss: '#537B53' },
  { color: '#D6A15F', moss: '#8B8051' },
  { color: '#68B9C6', moss: '#527F70' },
];

const NODE_COLORS = ['#8BC9A0', '#E0B66F', '#72C6D1', '#C4A6D8', '#D1816D', '#D5CF85'];

const makeRandom = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function makeTaperedTube(curve, baseRadius, tipRadius, segments = 24, sides = 9) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let ring = 0; ring <= segments; ring += 1) {
    const t = ring / segments;
    const center = curve.getPointAt(t);
    const radius = tipRadius + (baseRadius - tipRadius) * Math.pow(1 - t, 1.2);
    for (let side = 0; side <= sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const offset = frames.normals[ring].clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * radius);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      uvs.push(side / sides, t);
      if (ring < segments && side < sides) {
        const a = ring * (sides + 1) + side;
        const b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBarkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const random = makeRandom(771);
  context.fillStyle = '#9A7855';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 185; index += 1) {
    const x = random() * canvas.width;
    const width = 1 + random() * 5;
    context.strokeStyle = random() > 0.52 ? 'rgba(40, 31, 22, 0.2)' : 'rgba(229, 193, 143, 0.16)';
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x + (random() - 0.5) * 18, 150, x + (random() - 0.5) * 16, 330, x + (random() - 0.5) * 12, canvas.height);
    context.stroke();
  }

  for (let index = 0; index < 2200; index += 1) {
    const shade = Math.floor(98 + random() * 108);
    context.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.78)}, ${Math.floor(shade * 0.54)}, ${random() * 0.12})`;
    context.fillRect(random() * canvas.width, random() * canvas.height, 1 + random() * 2, 2 + random() * 8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function LivingYggdrasil({ className = '', light = false, view = 'welcome' }) {
  const mountRef = useRef(null);
  const cameraTargetRef = useRef({ x: 0, y: 3.85, z: 36, lookY: 3.85 });

  useEffect(() => {
    const compact = window.innerWidth < 620;
    const views = {
      welcome: { x: 0, y: compact ? 2.8 : 4.05, z: compact ? 38 : 34, lookY: compact ? 2.8 : 4.05 },
      institution: { x: compact ? -4.6 : -5.4, y: compact ? -2.4 : -2.1, z: compact ? 31 : 29, lookX: compact ? -4.6 : -5.4, lookY: compact ? -6.1 : -6.0 },
      worlds: { x: 0, y: compact ? 6.1 : 6.3, z: compact ? 20 : 14.5, lookY: compact ? 6.1 : 6.3 },
      login: { x: 0, y: compact ? 1.25 : 1.3, z: compact ? 19 : 15, lookY: compact ? 1.2 : 1.3 },
      'sector-campus': { x: -4.55, y: 4.95, z: compact ? 13 : 10, lookX: -4.55, lookY: 4.95 },
      'sector-enterprise': { x: 0, y: 6.4, z: compact ? 14 : 11, lookX: 0, lookY: 6.4 },
      'sector-hospital': { x: 4.55, y: 3.35, z: compact ? 13 : 10, lookX: 4.55, lookY: 3.35 },
    };
    cameraTargetRef.current = views[view] || views.welcome;
  }, [view]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    camera.position.set(0, 3.85, 36);
    camera.lookAt(0, 3.85, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    mount.appendChild(renderer.domElement);

    const geometries = new Set();
    const materials = new Set();
    const animated = [];
    const shoots = [];
    const roots = [];
    const realmPods = [];
    const rootSignals = [];
    const sensorClusters = [];
    const keepGeometry = geometry => (geometries.add(geometry), geometry);
    const keepMaterial = material => (materials.add(material), material);

    const tree = new THREE.Group();
    const compact = mount.clientWidth < 620;
    if (view === 'welcome') {
      tree.scale.set(compact ? 2.05 : 2.35, compact ? 1.18 : 1.22, compact ? 1.6 : 1.82);
      if (compact) tree.position.y = 0.45;
    } else if (view === 'institution') {
      tree.scale.setScalar(compact ? 0.72 : 0.98);
      if (compact) tree.position.y = 0.15;
    } else {
      tree.scale.setScalar(compact ? 0.53 : 0.8);
      if (compact) tree.position.y = 0.2;
    }
    scene.add(tree);

    const barkTexture = makeBarkTexture();
    const barkMaterial = keepMaterial(new THREE.MeshStandardMaterial({
      color: light ? '#AD875F' : '#97704B',
      map: barkTexture,
      bumpMap: barkTexture,
      bumpScale: 0.07,
      roughness: 0.94,
      metalness: 0,
    }));
    const branchMaterial = keepMaterial(new THREE.MeshStandardMaterial({
      color: light ? '#A77D53' : '#8E6742',
      bumpMap: barkTexture,
      bumpScale: 0.035,
      roughness: 0.96,
    }));
    const mossMaterial = keepMaterial(new THREE.MeshStandardMaterial({
      color: light ? '#668768' : '#668666',
      roughness: 1,
    }));
    const leafMaterial = keepMaterial(new THREE.MeshStandardMaterial({
      color: '#75A85B',
      roughness: 0.82,
      side: THREE.DoubleSide,
    }));
    const leafGeometry = keepGeometry(new THREE.SphereGeometry(1, 8, 6));

    const trunkMotion = new THREE.Group();
    trunkMotion.position.y = -2.55;
    tree.add(trunkMotion);
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.16, 1.7, 0.02),
      new THREE.Vector3(0.17, 3.6, -0.06),
      new THREE.Vector3(-0.1, 5.6, 0.05),
      new THREE.Vector3(0.04, 7.5, 0.02),
      new THREE.Vector3(0.3, 9.35, 0.12),
    ]);
    const trunkGeometry = keepGeometry(makeTaperedTube(trunkCurve, 1.48, 0.14, 54, 18));
    const trunk = new THREE.Mesh(trunkGeometry, barkMaterial);
    trunkMotion.add(trunk);
    animated.push({ node: trunkMotion, base: trunkMotion.quaternion.clone(), axis: new THREE.Vector3(0, 0, 1), amp: 0.016, speed: 0.45, phase: 0.3 });

    const trunkFlutes = 5;
    for (let flute = 0; flute < trunkFlutes; flute += 1) {
      const angle = (flute / trunkFlutes) * Math.PI * 2;
      const points = trunkCurve.points.map((point, index) => {
        const y = point.y;
        const radius = 1.06 - (y / 9.6) * 0.82;
        return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      });
      const fluteCurve = new THREE.CatmullRomCurve3(points);
      const fluteGeometry = keepGeometry(makeTaperedTube(fluteCurve, 0.065, 0.008, 40, 7));
      const fluteMesh = new THREE.Mesh(fluteGeometry, branchMaterial);
      trunkMotion.add(fluteMesh);
    }

    const rootBase = new THREE.Group();
    rootBase.position.y = -2.55;
    tree.add(rootBase);
    const rootRandom = makeRandom(918);
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2 + (rootRandom() - 0.5) * 0.18;
      const length = 6.2 + rootRandom() * 5.2;
      const depthSpread = (rootRandom() - 0.5) * 1.1;
      const rootMotion = new THREE.Group();
      rootMotion.rotation.y = angle;
      rootBase.add(rootMotion);
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.15, 0),
        new THREE.Vector3(0.08, -0.18, 0.12),
        new THREE.Vector3(0.5, -1.05, depthSpread * 0.45),
        new THREE.Vector3(length * 0.72, -2.0, depthSpread),
        new THREE.Vector3(length, -3.05 - rootRandom() * 0.8, depthSpread * 1.5),
      ]);
      const rootGeometry = keepGeometry(makeTaperedTube(rootCurve, 0.66 + rootRandom() * 0.26, 0.018, 42, 13));
      rootMotion.add(new THREE.Mesh(rootGeometry, barkMaterial));
      const rootVeinCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.08, -0.04, 0.08),
        new THREE.Vector3(0.5, -0.48, depthSpread * 0.35),
        new THREE.Vector3(length * 0.83, -0.94, depthSpread * 1.28),
      ]);
      const veinGeometry = keepGeometry(makeTaperedTube(rootVeinCurve, 0.04, 0.004, 20, 6));
      rootMotion.add(new THREE.Mesh(veinGeometry, branchMaterial));
      roots.push({ node: rootMotion, base: rootMotion.quaternion.clone(), axis: new THREE.Vector3(0, 0, 1), amp: 0.035 + rootRandom() * 0.035, speed: 0.62 + rootRandom() * 0.18, phase: rootRandom() * Math.PI * 2 });
    }

    const earth = new THREE.Group();
    earth.position.y = -4.08;
    tree.add(earth);
    const earthMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: '#FFFFFF', vertexColors: true, side: THREE.DoubleSide }));
    const terrainGeometry = keepGeometry(new THREE.PlaneGeometry(64, 52, 64, 38));
    const terrainPositions = terrainGeometry.getAttribute('position');
    const terrainColors = [];
    for (let vertex = 0; vertex < terrainPositions.count; vertex += 1) {
      const x = terrainPositions.getX(vertex);
      const z = terrainPositions.getY(vertex);
      const relief = Math.sin(x * 0.11) * 1.05 + Math.cos(z * 0.17) * 0.7 + Math.sin((x + z) * 0.08) * 0.42;
      terrainPositions.setZ(vertex, relief);
      const shade = THREE.MathUtils.clamp(0.35 + relief * 0.08 + Math.sin(x * 0.46 + z * 0.33) * 0.045, 0.12, 0.67);
      const color = new THREE.Color('#0D1712').lerp(new THREE.Color('#314332'), shade);
      terrainColors.push(color.r, color.g, color.b);
    }
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeometry, earthMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = 0.12;
    earth.add(terrain);
    for (let patch = 0; patch < 38; patch += 1) {
      const angle = rootRandom() * Math.PI * 2;
      const radius = 1.8 + rootRandom() * 7.6;
      const grass = new THREE.Mesh(
        keepGeometry(new THREE.IcosahedronGeometry(0.08 + rootRandom() * 0.13, 0)),
        mossMaterial,
      );
      grass.position.set(Math.cos(angle) * radius, 0.15 + rootRandom() * 0.04, Math.sin(angle) * radius * 0.47);
      grass.scale.y = 0.35;
      earth.add(grass);
    }

    const subsoilMaterial = keepMaterial(new THREE.MeshStandardMaterial({
      color: light ? '#26392E' : '#111D19',
      roughness: 1,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    }));
    const subsoilShape = new THREE.Shape();
    subsoilShape.moveTo(-17, -4.25);
    subsoilShape.bezierCurveTo(-13, -4.55, -10, -4.02, -7, -4.32);
    subsoilShape.bezierCurveTo(-3, -4.68, 0, -4.04, 4, -4.3);
    subsoilShape.bezierCurveTo(9, -4.62, 13, -4.02, 17, -4.24);
    subsoilShape.lineTo(17, -13.5);
    subsoilShape.lineTo(-17, -13.5);
    subsoilShape.closePath();
    const subsoil = new THREE.Mesh(keepGeometry(new THREE.ShapeGeometry(subsoilShape, 28)), subsoilMaterial);
    subsoil.position.z = 2.34;
    tree.add(subsoil);
    const stratumMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: '#77906E', transparent: true, opacity: 0.22 }));
    [-5.4, -7.2, -9.15, -10.5].forEach((height, index) => {
      const stratumCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-16, height, 2.44),
        new THREE.Vector3(-8, height + (index % 2 ? 0.24 : -0.14), 2.44),
        new THREE.Vector3(0, height - 0.2, 2.44),
        new THREE.Vector3(9, height + 0.17, 2.44),
        new THREE.Vector3(16, height, 2.44),
      ]);
      tree.add(new THREE.Mesh(keepGeometry(makeTaperedTube(stratumCurve, 0.014, 0.01, 42, 4)), stratumMaterial));
    });

    const rootAnchor = new THREE.Vector3(0, -3.86, 8.6);
    const taprootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -3.1, 0.16),
      new THREE.Vector3(-0.16, -4.15, 0.95),
      new THREE.Vector3(0.2, -5.5, 1.95),
      rootAnchor,
      new THREE.Vector3(0.18, -6.6, 7.4),
      new THREE.Vector3(-0.2, -8.2, 8.1),
      new THREE.Vector3(0.24, -10.45, 8.6),
    ]);
    tree.add(new THREE.Mesh(keepGeometry(makeTaperedTube(taprootCurve, 0.78, 0.17, 56, 15)), barkMaterial));

    const networkRootMaterial = keepMaterial(new THREE.MeshStandardMaterial({
      color: '#574633',
      map: barkTexture,
      bumpMap: barkTexture,
      bumpScale: 0.055,
      roughness: 0.98,
    }));
    const clusterPositions = [
      new THREE.Vector3(-10.0, -6.25, 11.5),
      new THREE.Vector3(-7.2, -5.0, 11.4),
      new THREE.Vector3(-4.4, -6.45, 11.6),
      new THREE.Vector3(-9.0, -8.0, 11.5),
      new THREE.Vector3(-6.1, -8.5, 11.4),
      new THREE.Vector3(-3.2, -8.05, 11.6),
    ];
    const clusterRandom = makeRandom(1701);
    clusterPositions.forEach((position, index) => {
      const cluster = new THREE.Group();
      cluster.position.copy(position);
      cluster.scale.setScalar(1.9);
      tree.add(cluster);
      const clusterColor = NODE_COLORS[index];
      const nodeMaterial = keepMaterial(new THREE.MeshBasicMaterial({
        color: clusterColor,
      }));
      const core = new THREE.Mesh(keepGeometry(new THREE.IcosahedronGeometry(0.22, 1)), nodeMaterial);
      cluster.add(core);
      for (let node = 0; node < 7; node += 1) {
        const angle = (node / 7) * Math.PI * 2 + clusterRandom() * 0.24;
        const radius = 0.34 + clusterRandom() * 0.28;
        const nodePosition = new THREE.Vector3(Math.cos(angle) * radius, (clusterRandom() - 0.5) * 0.44, Math.sin(angle) * radius * 0.4);
        const linkCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          nodePosition.clone().multiplyScalar(0.54).add(new THREE.Vector3(0, -0.06, 0)),
          nodePosition,
        ]);
        cluster.add(new THREE.Mesh(keepGeometry(makeTaperedTube(linkCurve, 0.018, 0.009, 7, 4)), networkRootMaterial));
        const sensorMaterial = keepMaterial(new THREE.MeshBasicMaterial({
          color: clusterColor,
        }));
        const sensor = new THREE.Mesh(keepGeometry(new THREE.SphereGeometry(0.095, 12, 9)), sensorMaterial);
        sensor.position.copy(nodePosition);
        cluster.add(sensor);
      }
      const haloMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: clusterColor, transparent: true, opacity: 0.62 }));
      const halo = new THREE.Mesh(keepGeometry(new THREE.TorusGeometry(0.78, 0.02, 5, 42)), haloMaterial);
      halo.rotation.x = Math.PI / 2;
      cluster.add(halo);
      sensorClusters.push({ node: cluster, core, phase: index * 1.13, color: clusterColor });

      const rootCurve = new THREE.CatmullRomCurve3([
        rootAnchor.clone(),
        new THREE.Vector3(position.x * 0.18, -4.65, 9.5),
        new THREE.Vector3(position.x * 0.48, position.y + 1.1, 10.6),
        new THREE.Vector3(position.x * 0.8, position.y + 0.05, 11.25),
        position.clone(),
      ]);
      const conduitMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: clusterColor, transparent: true, opacity: 0.72 }));
      tree.add(new THREE.Mesh(keepGeometry(makeTaperedTube(rootCurve, 0.045, 0.026, 48, 7)), conduitMaterial));
      for (let pulse = 0; pulse < 3; pulse += 1) {
        const pulseMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: clusterColor, transparent: true, opacity: 1 }));
        const signal = new THREE.Mesh(keepGeometry(new THREE.SphereGeometry(0.24 + pulse * 0.025, 14, 10)), pulseMaterial);
        tree.add(signal);
        rootSignals.push({ node: signal, curve: rootCurve, phase: pulse / 3 + index * 0.08, speed: 0.19 + index * 0.009 });
      }
    });

    const leafRandom = makeRandom(119);
    const addLeafCluster = (parent, position, seed) => {
      const random = makeRandom(seed + 17);
      const cluster = new THREE.Group();
      cluster.position.copy(position);
      parent.add(cluster);
      const count = 42;
      const foliage = new THREE.InstancedMesh(leafGeometry, leafMaterial, count);
      foliage.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const dummy = new THREE.Object3D();
      for (let leaf = 0; leaf < count; leaf += 1) {
        const direction = new THREE.Vector3(random() - 0.5, random() * 0.8, random() - 0.5).normalize();
        const spread = 0.18 + random() * 0.48;
        dummy.position.copy(direction).multiplyScalar(spread);
        dummy.scale.set(0.14 + random() * 0.09, 0.065 + random() * 0.045, 0.035 + random() * 0.025);
        dummy.rotation.set(random() * 0.8, random() * Math.PI * 2, random() * 0.9);
        dummy.updateMatrix();
        foliage.setMatrixAt(leaf, dummy.matrix);
        foliage.setColorAt(leaf, new THREE.Color().setHSL(0.27 + random() * 0.1, 0.34 + random() * 0.19, 0.43 + random() * 0.23));
      }
      foliage.instanceMatrix.needsUpdate = true;
      if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
      cluster.add(foliage);
      shoots.push({ node: cluster, base: cluster.quaternion.clone(), axis: new THREE.Vector3(0, 0, 1), amp: 0.11 + random() * 0.07, speed: 1.1 + random() * 0.45, phase: random() * Math.PI * 2 });
    };

    let branchIndex = 0;
    const growBranch = (parent, start, direction, length, radius, depth, seed) => {
      const limb = new THREE.Group();
      limb.position.copy(start);
      const normalizedDirection = direction.clone().normalize();
      const baseOrientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDirection);
      limb.quaternion.copy(baseOrientation);
      parent.add(limb);

      const bendX = Math.sin(seed * 6.2) * 0.24 * length;
      const bendZ = Math.cos(seed * 3.8) * 0.22 * length;
      const branchCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(bendX * 0.16, length * 0.26, bendZ * 0.1),
        new THREE.Vector3(bendX * 0.68, length * 0.58, bendZ * 0.58),
        new THREE.Vector3(bendX, length * 0.84, bendZ),
        new THREE.Vector3(bendX * 0.76, length, bendZ * 1.14),
      ]);
      const geometry = keepGeometry(makeTaperedTube(branchCurve, radius, Math.max(0.009, radius * 0.055), 20, 9));
      limb.add(new THREE.Mesh(geometry, branchMaterial));
      const phase = leafRandom() * Math.PI * 2;
      animated.push({
        node: limb,
        base: baseOrientation,
        axis: new THREE.Vector3(0, 0, 1),
        amp: 0.012 + (4 - depth) * 0.014,
        speed: 0.45 + leafRandom() * 0.3,
        phase,
      });
      branchIndex += 1;

      if (depth <= 0) {
        const end = branchCurve.getPoint(1);
        const shoot = new THREE.Group();
        shoot.position.copy(end);
        limb.add(shoot);
        const sproutDirections = [
          new THREE.Vector3(-0.48, 0.84, 0.05),
          new THREE.Vector3(0.28, 0.96, 0.12),
          new THREE.Vector3(0.72, 0.56, -0.04),
        ];
        sproutDirections.forEach((sproutDirection, index) => {
          const shootEnd = sproutDirection.clone().multiplyScalar(0.42 + index * 0.04);
          const sproutCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            shootEnd.clone().multiplyScalar(0.5).add(new THREE.Vector3(0.04, 0.03, 0)),
            shootEnd,
          ]);
          const sproutGeometry = keepGeometry(makeTaperedTube(sproutCurve, 0.032, 0.004, 9, 5));
          shoot.add(new THREE.Mesh(sproutGeometry, mossMaterial));
          addLeafCluster(shoot, shootEnd, seed * 31 + index);
        });
        shoots.push({ node: shoot, base: shoot.quaternion.clone(), axis: new THREE.Vector3(0, 0, 1), amp: 0.12, speed: 0.9, phase });
        return;
      }

      const branchPointA = branchCurve.getPoint(0.58);
      const branchPointB = branchCurve.getPoint(0.84);
      const side = seed % 2 === 0 ? 1 : -1;
      const childLength = length * (0.61 + leafRandom() * 0.07);
      const childRadius = radius * 0.59;
      growBranch(limb, branchPointA, new THREE.Vector3(side * (0.62 + leafRandom() * 0.2), 0.74, leafRandom() * 0.45 - 0.22), childLength, childRadius, depth - 1, seed * 2 + 1);
      growBranch(limb, branchPointB, new THREE.Vector3(-side * (0.68 + leafRandom() * 0.2), 0.61, leafRandom() * 0.5 - 0.25), childLength * 0.78, childRadius * 0.82, depth - 1, seed * 2 + 2);
    };

    const boughSeed = makeRandom(208);
    for (let tier = 0; tier < 5; tier += 1) {
      const branchesInTier = tier < 4 ? 3 : 2;
      for (let branchIndex = 0; branchIndex < branchesInTier; branchIndex += 1) {
        const azimuth = tier * 1.13 + branchIndex * (Math.PI * 2 / branchesInTier) + (boughSeed() - 0.5) * 0.42;
        const horizontal = 0.64 + boughSeed() * 0.2;
        const direction = new THREE.Vector3(
          Math.cos(azimuth) * horizontal,
          0.47 + boughSeed() * 0.42,
          Math.sin(azimuth) * horizontal,
        );
        const trunkY = 2.15 + tier * 1.35 + (boughSeed() - 0.5) * 0.52;
        const length = 4.15 - tier * 0.24 + boughSeed() * 1.05;
        const start = new THREE.Vector3((boughSeed() - 0.5) * 0.24, trunkY, (boughSeed() - 0.5) * 0.24);
        growBranch(tree, start, direction, length, 0.38 - tier * 0.033, 4, tier * 17 + branchIndex + 8);
      }
    }
    growBranch(tree, new THREE.Vector3(0, 6.5, 0), new THREE.Vector3(-0.1, 1, 0), 3.25, 0.28, 3, 91);
    growBranch(tree, new THREE.Vector3(0.08, 7.3, 0), new THREE.Vector3(0.22, 0.98, 0.05), 2.65, 0.2, 2, 95);

    const createWorldPod = (index, position) => {
      const data = REALMS[index];
      const pod = new THREE.Group();
      pod.position.copy(position);
      pod.position.z += 1.3;
      pod.scale.setScalar(2.16);
      tree.add(pod);
      const soilMaterial = keepMaterial(new THREE.MeshStandardMaterial({ color: data.moss, roughness: 0.94 }));
      for (let patch = 0; patch < 9; patch += 1) {
        const mound = new THREE.Mesh(keepGeometry(new THREE.IcosahedronGeometry(0.12 + boughSeed() * 0.07, 1)), soilMaterial);
        mound.position.set((boughSeed() - 0.5) * 1.9, 0.04, (boughSeed() - 0.5) * 0.95);
        mound.scale.set(0.85, 0.2, 0.55);
        pod.add(mound);
      }

      const buildingMaterial = keepMaterial(new THREE.MeshStandardMaterial({
        color: index === 2 ? '#DDEAE2' : index === 1 ? '#C8BEA8' : '#D2D5C0',
        roughness: 0.72,
        metalness: 0.04,
      }));
      const roofMaterial = keepMaterial(new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.68, metalness: 0.08 }));
      const glassMaterial = keepMaterial(new THREE.MeshStandardMaterial({ color: '#8DBBB0', emissive: data.color, emissiveIntensity: 0.12, roughness: 0.28, metalness: 0.18 }));
      const roadMaterial = keepMaterial(new THREE.MeshStandardMaterial({ color: '#454C45', roughness: 0.94 }));
      const addBlock = (x, z, width, height, depth, variant = 0) => {
        const block = new THREE.Group();
        block.position.set(x, 0.25 + height / 2, z);
        pod.add(block);
        const body = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(width, height, depth)), buildingMaterial);
        block.add(body);
        const roof = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(width * 1.035, 0.07, depth * 1.035)), roofMaterial);
        roof.position.y = height / 2 + 0.035;
        block.add(roof);
        const rows = Math.max(2, Math.floor(height / 0.18));
        const columns = Math.max(2, Math.floor(width / 0.14));
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const pane = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(0.038, 0.052, 0.012)), glassMaterial);
            pane.position.set(
              (column - (columns - 1) / 2) * (width / (columns + 0.4)),
              -height * 0.35 + row * Math.min(0.15, height / (rows + 0.7)),
              depth / 2 + 0.009,
            );
            block.add(pane);
          }
        }
        if (variant === 1) {
          const solar = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(width * 0.55, 0.025, depth * 0.55)), glassMaterial);
          solar.position.set(width * 0.16, height / 2 + 0.085, -depth * 0.08);
          block.add(solar);
        }
        return block;
      };
      const addRoad = (x, z, width, depth, rotation = 0) => {
        const road = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(width, 0.025, depth)), roadMaterial);
        road.position.set(x, 0.265, z);
        road.rotation.y = rotation;
        pod.add(road);
      };

      if (index === 0) {
        addBlock(-0.47, -0.04, 0.64, 0.46, 0.42, 1);
        addBlock(0.22, 0.13, 0.54, 0.75, 0.46, 0);
        addBlock(0.69, -0.18, 0.43, 0.38, 0.35, 1);
        addRoad(0.05, -0.46, 1.6, 0.09, -0.12);
      } else if (index === 1) {
        addBlock(-0.55, -0.14, 0.45, 0.58, 0.42, 0);
        addBlock(-0.04, 0.08, 0.48, 1.02, 0.43, 1);
        addBlock(0.5, -0.15, 0.55, 0.72, 0.4, 0);
        addBlock(0.7, 0.25, 0.28, 0.39, 0.28, 1);
        addRoad(0, -0.47, 1.72, 0.1, 0.05);
      } else {
        addBlock(-0.48, -0.05, 0.65, 0.43, 0.46, 0);
        addBlock(0.2, 0.12, 0.55, 0.9, 0.48, 1);
        addBlock(0.68, -0.15, 0.42, 0.5, 0.4, 0);
        const crossVertical = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(0.09, 0.33, 0.05)), roofMaterial);
        crossVertical.position.set(0.2, 0.84, 0.37);
        pod.add(crossVertical);
        const crossHorizontal = new THREE.Mesh(keepGeometry(new THREE.BoxGeometry(0.27, 0.08, 0.05)), roofMaterial);
        crossHorizontal.position.set(0.2, 0.88, 0.37);
        pod.add(crossHorizontal);
        const helipad = new THREE.Mesh(keepGeometry(new THREE.TorusGeometry(0.19, 0.018, 5, 24)), roofMaterial);
        helipad.position.set(-0.48, 0.49, -0.05);
        helipad.rotation.x = -Math.PI / 2;
        pod.add(helipad);
      }

      for (let treeIndex = 0; treeIndex < 5; treeIndex += 1) {
        const x = (boughSeed() - 0.5) * 1.8;
        const z = (boughSeed() - 0.5) * 1.1;
        const trunk = new THREE.Mesh(keepGeometry(new THREE.CylinderGeometry(0.018, 0.035, 0.26, 5)), barkMaterial);
        trunk.position.set(x, 0.36, z);
        pod.add(trunk);
        const crown = new THREE.Mesh(keepGeometry(new THREE.IcosahedronGeometry(0.14 + boughSeed() * 0.07, 1)), mossMaterial);
        crown.position.set(x, 0.55, z);
        pod.add(crown);
      }
      realmPods.push({ node: pod, baseY: pod.position.y, phase: index * 2.1, speed: 0.7 + index * 0.08 });
    };

    createWorldPod(0, new THREE.Vector3(-5.65, 6.2, 0.25));
    createWorldPod(1, new THREE.Vector3(0, 8, 0.4));
    createWorldPod(2, new THREE.Vector3(5.65, 4.15, 0.25));

    const starPositions = new Float32Array(320 * 3);
    const starRandom = makeRandom(803);
    for (let index = 0; index < 320; index += 1) {
      starPositions[index * 3] = (starRandom() - 0.5) * 28;
      starPositions[index * 3 + 1] = (starRandom() - 0.35) * 19;
      starPositions[index * 3 + 2] = -3 - starRandom() * 9;
    }
    const starGeometry = keepGeometry(new THREE.BufferGeometry());
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = keepMaterial(new THREE.PointsMaterial({
      color: light ? '#849384' : '#E4D8B9',
      size: 0.027,
      transparent: true,
      opacity: light ? 0.3 : 0.62,
    }));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    scene.add(new THREE.HemisphereLight(light ? '#E8F2DC' : '#D7E6D5', '#342C23', 1.7));
    const warmLight = new THREE.DirectionalLight(light ? '#FFF0D6' : '#FFE0A9', 2.45);
    warmLight.position.set(-5, 10, 9);
    scene.add(warmLight);
    const coolLight = new THREE.DirectionalLight('#91BBD0', 0.9);
    coolLight.position.set(6, 3, -5);
    scene.add(coolLight);

    let frameId;
    const animationStart = performance.now();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - animationStart) / 1000;
      const target = cameraTargetRef.current;
      camera.position.x += (target.x - camera.position.x) * 0.028;
      camera.position.y += (target.y - camera.position.y) * 0.028;
      camera.position.z += (target.z - camera.position.z) * 0.028;
      camera.lookAt(target.lookX ?? 0, target.lookY, 0);

      tree.rotation.y = Math.sin(elapsed * 0.12) * 0.025;
      trunkMotion.rotation.z = Math.sin(elapsed * 0.42) * 0.012;
      animated.forEach(({ node, base, axis, amp, speed, phase }) => {
        const sway = new THREE.Quaternion().setFromAxisAngle(axis, Math.sin(elapsed * speed + phase) * amp);
        node.quaternion.copy(base).multiply(sway);
      });
      roots.forEach(({ node, base, axis, amp, speed, phase }) => {
        const sway = new THREE.Quaternion().setFromAxisAngle(axis, Math.sin(elapsed * speed + phase) * amp);
        node.quaternion.copy(base).multiply(sway);
      });
      shoots.forEach(({ node, base, axis, amp, speed, phase }) => {
        const sway = new THREE.Quaternion().setFromAxisAngle(axis, Math.sin(elapsed * speed + phase) * amp);
        node.quaternion.copy(base).multiply(sway);
      });
      rootSignals.forEach(({ node, curve, phase, speed }) => {
        const progress = (elapsed * speed + phase) % 1;
        node.position.copy(curve.getPointAt(1 - progress));
        const pulse = 0.82 + Math.sin(elapsed * 8 + phase * Math.PI * 2) * 0.18;
        node.scale.setScalar(pulse);
      });
      sensorClusters.forEach(({ node, core, phase }) => {
        const pulse = 1 + Math.max(0, Math.sin(elapsed * 2.3 + phase)) * 0.18;
        core.scale.setScalar(pulse);
        node.rotation.y = Math.sin(elapsed * 0.42 + phase) * 0.04;
      });
      realmPods.forEach(({ node, baseY, phase, speed }) => {
        node.position.y = baseY + Math.sin(elapsed * speed + phase) * 0.045;
        node.rotation.z = Math.sin(elapsed * 0.48 + phase) * 0.014;
      });
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      barkTexture.dispose();
    };
  }, [light]);

  return <div ref={mountRef} className={`h-full w-full ${className}`} aria-hidden="true" />;
}