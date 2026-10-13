import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function KnowledgeBase3D({ size = 112, className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = size;
    const h = size;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // 1. Outer Wireframe Geosphere (from user image asset)
    const outerGeo = new THREE.IcosahedronGeometry(1.6, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xF16B4F, // Terracotta highlight
      wireframe: true,
      transparent: true,
      opacity: 0.55
    });
    const outerSphere = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outerSphere);

    // 2. Dense Inner Core Sphere (nested wireframe orb)
    const innerGeo = new THREE.IcosahedronGeometry(1.0, 3);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xB83A2F, // Terracotta deep crimson
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerSphere);

    // 3. Dense Nucleus Point (warm glowing center)
    const corePointGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const corePointMat = new THREE.MeshBasicMaterial({
      color: 0xFF8566,
      transparent: true,
      opacity: 0.95
    });
    const corePoint = new THREE.Mesh(corePointGeo, corePointMat);
    scene.add(corePoint);

    // 4. Large Inclined Orbital Ring 1 (Terracotta/Red from image)
    const ring1Geo = new THREE.TorusGeometry(2.1, 0.03, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0xF16B4F,
      transparent: true,
      opacity: 0.85
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 2.8;
    ring1.rotation.y = 0.2;
    scene.add(ring1);

    // 5. Inclined Orbital Ring 2 (Muted teal/green arc from image)
    const ring2Geo = new THREE.TorusGeometry(2.35, 0.025, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x54B8C1,
      transparent: true,
      opacity: 0.7
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = -Math.PI / 5;
    scene.add(ring2);

    // 6. Constellation Orbiting Data Packets (Dots along orbital paths)
    const particleCount = 48;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);

    const cRed = new THREE.Color(0xF16B4F);
    const cTeal = new THREE.Color(0x54B8C1);
    const cGold = new THREE.Color(0xD7A34B);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const r = 1.7 + (i % 3) * 0.35;
      pPos[i * 3] = Math.cos(angle) * r;
      pPos[i * 3 + 1] = Math.sin(angle) * (r * 0.45);
      pPos[i * 3 + 2] = Math.sin(angle) * (r * 0.8);

      const col = i % 3 === 0 ? cRed : i % 3 === 1 ? cTeal : cGold;
      pColors[i * 3] = col.r;
      pColors[i * 3 + 1] = col.g;
      pColors[i * 3 + 2] = col.b;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Smooth Animation Loop
    let animId;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      // Continuous 3D rotation matching the user's wireframe structure
      outerSphere.rotation.y = elapsed * 0.28;
      outerSphere.rotation.x = elapsed * 0.16;

      innerSphere.rotation.y = -elapsed * 0.38;
      innerSphere.rotation.z = elapsed * 0.22;

      ring1.rotation.z = elapsed * 0.25;
      ring2.rotation.z = -elapsed * 0.18;

      particles.rotation.y = elapsed * 0.3;
      particles.rotation.x = Math.sin(elapsed * 0.2) * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      outerGeo.dispose();
      outerMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      corePointGeo.dispose();
      corePointMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      pGeo.dispose();
      pMat.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={`relative rounded-full overflow-hidden pointer-events-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
