import * as THREE from 'three';

export function generateZPRMesh(buildings, masts, conductors, R) {
  let minBoxX = Infinity, maxBoxX = -Infinity, minBoxZ = Infinity, maxBoxZ = -Infinity;

  if (buildings.length === 0 && masts.length === 0 && conductors.length === 0) {
     const dummyGeom = new THREE.PlaneGeometry(10, 10);
     dummyGeom.rotateX(-Math.PI / 2);
     return { 
       geometry: dummyGeom, 
       bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, resX: 2, resZ: 2, cellSize: 0.8 }, 
       heightmap: new Float32Array(4).fill(0), 
       structmap: new Float32Array(4).fill(0) 
     };
  }

  buildings.forEach(b => {
     minBoxX = Math.min(minBoxX, b.position[0] - b.size[0]/2);
     maxBoxX = Math.max(maxBoxX, b.position[0] + b.size[0]/2);
     minBoxZ = Math.min(minBoxZ, b.position[2] - b.size[1]/2);
     maxBoxZ = Math.max(maxBoxZ, b.position[2] + b.size[1]/2);
  });
  
  masts.forEach(m => {
     minBoxX = Math.min(minBoxX, m.position[0]);
     maxBoxX = Math.max(maxBoxX, m.position[0]);
     minBoxZ = Math.min(minBoxZ, m.position[2]);
     maxBoxZ = Math.max(maxBoxZ, m.position[2]);
  });

  conductors.forEach(c => {
     minBoxX = Math.min(minBoxX, c.points[0][0], c.points[1][0]);
     maxBoxX = Math.max(maxBoxX, c.points[0][0], c.points[1][0]);
     minBoxZ = Math.min(minBoxZ, c.points[0][2], c.points[1][2]);
     maxBoxZ = Math.max(maxBoxZ, c.points[0][2], c.points[1][2]);
  });

  const safeR = (typeof R === 'number' && !isNaN(R) && R > 0) ? R : 60;
  const margin = safeR + 10;
  minBoxX -= margin; maxBoxX += margin;
  minBoxZ -= margin; maxBoxZ += margin;

  const gridSizeX = Math.max(1, maxBoxX - minBoxX);
  const gridSizeZ = Math.max(1, maxBoxZ - minBoxZ);
  
  const cellSize = 0.8;
  const resX = Math.max(2, Math.ceil(gridSizeX / cellSize));
  const resZ = Math.max(2, Math.ceil(gridSizeZ / cellSize));
  
  const arraySize = resX * resZ;
  const H = new Float32Array(arraySize).fill(0);
  const getIdx = (ix, iz) => iz * resX + ix;

  // 1. Build Structural Height Map (H)
  for (const b of buildings) {
    const [w, d, h] = b.size;
    const bMinX = b.position[0] - w/2;
    const bMaxX = b.position[0] + w/2;
    const bMinZ = b.position[2] - d/2;
    const bMaxZ = b.position[2] + d/2;
    const startX = Math.max(0, Math.floor((bMinX - minBoxX) / cellSize));
    const endX = Math.min(resX - 1, Math.ceil((bMaxX - minBoxX) / cellSize));
    const startZ = Math.max(0, Math.floor((bMinZ - minBoxZ) / cellSize));
    const endZ = Math.min(resZ - 1, Math.ceil((bMaxZ - minBoxZ) / cellSize));
    const yBase = b.position[1] + h/2;
    const isGable = b.roofType === 'gable';
    const isCyl = b.roofType === 'cylinder';
    const roofH = h * 0.4;
    const W_base = w >= d ? d : w;
    const isCylBody = b.buildingShape === 'cylinder';
    const bodyRadius = Math.max(w, d) / 2;

    for (let iz = startZ; iz <= endZ; iz++) {
      for (let ix = startX; ix <= endX; ix++) {
        const gx = ix * cellSize + minBoxX;
        const gz = iz * cellSize + minBoxZ;
        let inside = isCylBody ? (gx-b.position[0])**2 + (gz-b.position[2])**2 <= bodyRadius**2 : gx >= bMinX && gx <= bMaxX && gz >= bMinZ && gz <= bMaxZ;
        if (inside) {
           let cellY = yBase;
           if (isGable) {
              const relCross = (w >= d) ? Math.abs(gz - b.position[2]) : Math.abs(gx - b.position[0]);
              cellY = yBase + roofH * (1 - (relCross / (W_base / 2)));
           } else if (isCyl) {
              const relCross = (w >= d) ? Math.abs(gz - b.position[2]) : Math.abs(gx - b.position[0]);
              const rCurve = W_base / 2;
              if (relCross <= rCurve) cellY = yBase + Math.sqrt(Math.max(0, rCurve*rCurve - relCross*relCross));
           }
           const idx = getIdx(ix, iz);
           if (cellY > H[idx]) H[idx] = cellY;
        }
      }
    }
  }

  // 2. Initial Sphere Centers Map (C)
  const C = new Float32Array(arraySize).fill(safeR);
  const cellRadius = Math.ceil(safeR / cellSize);

  for (const m of masts) {
    const tipY = m.position[1] + m.height;
    const mx = m.position[0], mz = m.position[2];
    const mix = Math.floor((mx - minBoxX) / cellSize);
    const miz = Math.floor((mz - minBoxZ) / cellSize);
    for (let dz = -cellRadius; dz <= cellRadius; dz++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const ix = mix + dx, iz = miz + dz;
        if (ix >= 0 && ix < resX && iz >= 0 && iz < resZ) {
           const px = ix * cellSize + minBoxX, pz = iz * cellSize + minBoxZ;
           const d2 = (px - mx)**2 + (pz - mz)**2;
           if (d2 <= safeR * safeR) {
              const idx = getIdx(ix, iz);
              C[idx] = Math.max(C[idx], tipY + Math.sqrt(safeR*safeR - d2));
           }
        }
      }
    }
  }

  function distToSegSq(p, v, w) {
    const l2 = (v.x - w.x)**2 + (v.z - w.z)**2;
    if (l2 === 0) return { distSq: (p.x - v.x)**2 + (p.z - v.z)**2, t: 0 };
    let t = ((p.x - v.x) * (w.x - v.x) + (p.z - v.z) * (w.z - v.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    return { distSq: (p.x - (v.x + t * (w.x - v.x)))**2 + (p.z - (v.z + t * (w.z - v.z)))**2, t };
  }

  for (const c of conductors) {
    const p1 = { x: c.points[0][0], y: c.points[0][1], z: c.points[0][2] };
    const p2 = { x: c.points[1][0], y: c.points[1][1], z: c.points[1][2] };
    const cxMin = Math.min(p1.x, p2.x) - safeR, cxMax = Math.max(p1.x, p2.x) + safeR;
    const czMin = Math.min(p1.z, p2.z) - safeR, czMax = Math.max(p1.z, p2.z) + safeR;
    const startX = Math.max(0, Math.floor((cxMin - minBoxX) / cellSize));
    const endX = Math.min(resX - 1, Math.ceil((cxMax - minBoxX) / cellSize));
    const startZ = Math.max(0, Math.floor((czMin - minBoxZ) / cellSize));
    const endZ = Math.min(resZ - 1, Math.ceil((czMax - minBoxZ) / cellSize));
    for (let iz = startZ; iz <= endZ; iz++) {
      for (let ix = startX; ix <= endX; ix++) {
        const px = ix * cellSize + minBoxX, pz = iz * cellSize + minBoxZ;
        const { distSq, t } = distToSegSq({x: px, z: pz}, p1, p2);
        if (distSq <= safeR * safeR) {
          const lineY = p1.y + t * (p2.y - p1.y);
          const idx = getIdx(ix, iz);
          C[idx] = Math.max(C[idx], lineY + Math.sqrt(safeR*safeR - distSq));
        }
      }
    }
  }

  for (const b of buildings) {
    const [w, d, h] = b.size;
    const bx = b.position[0], bz = b.position[2], by = b.position[1] + h/2;
    const mix = Math.floor((bx - minBoxX) / cellSize);
    const miz = Math.floor((bz - minBoxZ) / cellSize);
    const rangeX = Math.ceil((w/2 + safeR) / cellSize);
    const rangeZ = Math.ceil((d/2 + safeR) / cellSize);
    for (let dz = -rangeZ; dz <= rangeZ; dz++) {
      for (let dx = -rangeX; dx <= rangeX; dx++) {
        const ix = mix + dx, iz = miz + dz;
        if (ix >= 0 && ix < resX && iz >= 0 && iz < resZ) {
           const px = ix * cellSize + minBoxX, pz = iz * cellSize + minBoxZ;
           const dx_rect = Math.max(bx - w/2 - px, 0, px - (bx + w/2));
           const dz_rect = Math.max(bz - d/2 - pz, 0, pz - (bz + d/2));
           const distSq = dx_rect*dx_rect + dz_rect*dz_rect;
           if (distSq <= safeR * safeR) {
              const idx = getIdx(ix, iz);
              C[idx] = Math.max(C[idx], by + Math.sqrt(safeR*safeR - distSq));
           }
        }
      }
    }
  }

  // 3. Erosion pass
  const E = new Float32Array(arraySize).fill(10000);
  const erosionOffsets = [];
  for (let dz = -cellRadius; dz <= cellRadius; dz++) {
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const dSq = (dx * cellSize)**2 + (dz * cellSize)**2;
        if (dSq <= safeR * safeR) erosionOffsets.push({ dx, dz, hOffset: Math.sqrt(safeR*safeR - dSq) });
    }
  }

  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      let minH = 10000;
      for (const offset of erosionOffsets) {
         const ix = x + offset.dx, iz = z + offset.dz;
         if (ix >= 0 && ix < resX && iz >= 0 && iz < resZ) {
            const val = C[getIdx(ix, iz)] - offset.hOffset;
            if (val < minH) minH = val;
         } else {
            const val = safeR - offset.hOffset; if (val < minH) minH = val;
         }
      }
      E[getIdx(x, z)] = Math.max(Math.max(minH, H[getIdx(x, z)]), 0);
    }
  }

  // 4. Mesh Generation
  const architectureGeom = new THREE.PlaneGeometry(gridSizeX, gridSizeZ, resX - 1, resZ - 1);
  architectureGeom.rotateX(-Math.PI / 2);
  const posArr = architectureGeom.attributes.position.array;
  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      const vIdx = (z * resX + x) * 3;
      posArr[vIdx] = x * cellSize + minBoxX;
      posArr[vIdx + 1] = E[getIdx(x, z)];
      posArr[vIdx + 2] = z * cellSize + minBoxZ;
    }
  }

  const exposure = new Float32Array(arraySize);
  const distances = new Float32Array(arraySize);
  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      const idx = getIdx(x, z);
      const px = x * cellSize + minBoxX, pz = z * cellSize + minBoxZ;
      exposure[idx] = (E[idx] - H[idx] < 0.15) ? 1.0 : 0.0;
      let d2Min = Infinity;
      for (const b of buildings) {
        const bx = Math.max(b.position[0] - b.size[0]/2, Math.min(px, b.position[0] + b.size[0]/2));
        const bz = Math.max(b.position[2] - b.size[1]/2, Math.min(pz, b.position[2] + b.size[1]/2));
        const d2 = (px-bx)**2 + (pz-bz)**2; if(d2 < d2Min) d2Min = d2;
      }
      distances[idx] = Math.sqrt(d2Min || 0);
    }
  }
  architectureGeom.setAttribute('vExposure', new THREE.BufferAttribute(exposure, 1));
  architectureGeom.setAttribute('vDist', new THREE.BufferAttribute(distances, 1));
  architectureGeom.computeVertexNormals();

  return { geometry: architectureGeom, bounds: { minX: minBoxX, maxX: maxBoxX, minZ: minBoxZ, maxZ: maxBoxZ, resX, resZ, cellSize }, heightmap: E, structmap: H };
}
