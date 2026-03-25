import * as THREE from 'three';

export function generateZPRMesh(buildings, masts, conductors, R) {
  let minBoxX = Infinity, maxBoxX = -Infinity, minBoxZ = Infinity, maxBoxZ = -Infinity;

  if (buildings.length === 0 && masts.length === 0 && conductors.length === 0) {
     return new THREE.PlaneGeometry(100, 100);
  }

  buildings.forEach(b => {
     minBoxX = Math.min(minBoxX, b.position[0] - b.size[0]/2);
     maxBoxX = Math.max(maxBoxX, b.position[0] + b.size[0]/2);
     minBoxZ = Math.min(minBoxZ, b.position[2] - b.size[2]/2);
     maxBoxZ = Math.max(maxBoxZ, b.position[2] + b.size[2]/2);
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

  // Adding generous blanket margin equals to R + 10 padding
  // This flawlessly frames the entire architectural setup and rests the blanket on the ground
  const margin = R + 10;
  minBoxX -= margin; maxBoxX += margin;
  minBoxZ -= margin; maxBoxZ += margin;

  const gridSizeX = maxBoxX - minBoxX;
  const gridSizeZ = maxBoxZ - minBoxZ;
  
  // Set cell size fixed to 1.25 meters. This makes the math extremely fluid and lightweight
  // keeping the visual resolution totally uniform and robust, eliminating freezing!
  const cellSize = 1.25;
  const resX = Math.max(2, Math.ceil(gridSizeX / cellSize));
  const resZ = Math.max(2, Math.ceil(gridSizeZ / cellSize));
  
  const arraySize = resX * resZ;
  const H = new Float32Array(arraySize).fill(0);
  const getIdx = (ix, iz) => iz * resX + ix;

  for (const b of buildings) {
    const bMinX = b.position[0] - b.size[0] / 2;
    const bMaxX = b.position[0] + b.size[0] / 2;
    const bMinZ = b.position[2] - b.size[2] / 2;
    const bMaxZ = b.position[2] + b.size[2] / 2;

    const startX = Math.max(0, Math.floor((bMinX - minBoxX) / cellSize));
    const endX = Math.min(resX - 1, Math.ceil((bMaxX - minBoxX) / cellSize));
    const startZ = Math.max(0, Math.floor((bMinZ - minBoxZ) / cellSize));
    const endZ = Math.min(resZ - 1, Math.ceil((bMaxZ - minBoxZ) / cellSize));

    const yBase = b.position[1] + b.size[1] / 2;
    const isFlat = !b.roofType || b.roofType === 'flat';
    const isGable = b.roofType === 'gable';
    const isCyl = b.roofType === 'cylinder';
    
    let protX = 0, protZ = 0, protW = 0, protH = 0, protD = 0;
    let hasProt = b.protrusion && b.protrusion !== 'none';
    if (hasProt) {
       protX = b.position[0] + (b.protOffset ? b.protOffset[0] : 0);
       protZ = b.position[2] + (b.protOffset ? b.protOffset[1] : 0);
       protW = b.protSize ? b.protSize[0] : 3;
       protH = b.protSize ? b.protSize[1] : 2;
       protD = b.protSize ? b.protSize[2] : 3;
    }

    const W = b.size[0] >= b.size[2] ? b.size[2] : b.size[0];
    const roofH = b.size[1] * 0.4;

    for (let iz = startZ; iz <= endZ; iz++) {
      for (let ix = startX; ix <= endX; ix++) {
        const gx = ix * cellSize + minBoxX;
        const gz = iz * cellSize + minBoxZ;
        
        if (gx >= bMinX && gx <= bMaxX && gz >= bMinZ && gz <= bMaxZ) {
           let cellY = yBase;
           
           if (isGable) {
              const longestIsX = b.size[0] >= b.size[2];
              const bx = gx - b.position[0];
              const bz = gz - b.position[2];
              const relCross = longestIsX ? Math.abs(bz) : Math.abs(bx);
              cellY = yBase + roofH * (1 - (relCross / (W / 2)));
           } else if (isCyl) {
              const longestIsX = b.size[0] >= b.size[2];
              const bx = gx - b.position[0];
              const bz = gz - b.position[2];
              const relCross = longestIsX ? Math.abs(bz) : Math.abs(bx);
              const rCurve = W / 2;
              if (relCross <= rCurve) {
                  cellY = yBase + Math.sqrt(Math.max(0, rCurve*rCurve - relCross*relCross));
              }
           }
           
           if (isFlat && hasProt) {
              if (gx >= protX - protW/2 && gx <= protX + protW/2 && gz >= protZ - protD/2 && gz <= protZ + protD/2) {
                  if (b.protrusion === 'chimney') {
                     if ((gx - protX)**2 + (gz - protZ)**2 <= (protW/2)**2) cellY = Math.max(cellY, yBase + protH);
                  } else {
                     cellY = Math.max(cellY, yBase + protH);
                  }
              }
           }
           
           const idx = getIdx(ix, iz);
           if (cellY > H[idx]) H[idx] = cellY;
        }
      }
    }
  }

  const C = new Float32Array(arraySize).fill(R);
  const cellRadius = Math.ceil(R / cellSize);

  for (const m of masts) {
    const mastTipY = m.position[1] + m.height;
    const mx = m.position[0];
    const mz = m.position[2];
    const mix = Math.floor((mx - minBoxX) / cellSize);
    const miz = Math.floor((mz - minBoxZ) / cellSize);

    for (let dz = -cellRadius; dz <= cellRadius; dz++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const ix = mix + dx;
        const iz = miz + dz;
        if (ix >= 0 && ix < resX && iz >= 0 && iz < resZ) {
           const px = ix * cellSize + minBoxX;
           const pz = iz * cellSize + minBoxZ;
           const distSq = (px - mx)**2 + (pz - mz)**2;
           if (distSq <= R * R) {
              const idx = getIdx(ix, iz);
              C[idx] = Math.max(C[idx], mastTipY + Math.sqrt(R * R - distSq));
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
    const cxMin = Math.min(p1.x, p2.x) - R;
    const cxMax = Math.max(p1.x, p2.x) + R;
    const czMin = Math.min(p1.z, p2.z) - R;
    const czMax = Math.max(p1.z, p2.z) + R;

    const startX = Math.max(0, Math.floor((cxMin - minBoxX) / cellSize));
    const endX = Math.min(resX - 1, Math.ceil((cxMax - minBoxX) / cellSize));
    const startZ = Math.max(0, Math.floor((czMin - minBoxZ) / cellSize));
    const endZ = Math.min(resZ - 1, Math.ceil((czMax - minBoxZ) / cellSize));

    for (let iz = startZ; iz <= endZ; iz++) {
      for (let ix = startX; ix <= endX; ix++) {
        const px = ix * cellSize + minBoxX;
        const pz = iz * cellSize + minBoxZ;
        const { distSq, t } = distToSegSq({x: px, z: pz}, p1, p2);
        
        if (distSq <= R * R) {
          const lineY = p1.y + t * (p2.y - p1.y);
          const hOffset = Math.sqrt(R * R - distSq);
          const idx = getIdx(ix, iz);
          C[idx] = Math.max(C[idx], lineY + hOffset);
        }
      }
    }
  }

  for (let idx = 0; idx < arraySize; idx++) {
    if (H[idx] > 0) C[idx] = Math.max(C[idx], H[idx] + R);
  }

  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      const h = H[getIdx(x, z)];
      if (h === 0) continue;
      let isUniform = true;
      if (x > 0 && H[getIdx(x-1, z)] !== h) isUniform = false;
      else if (x < resX-1 && H[getIdx(x+1, z)] !== h) isUniform = false;
      else if (z > 0 && H[getIdx(x, z-1)] !== h) isUniform = false;
      else if (z < resZ-1 && H[getIdx(x, z+1)] !== h) isUniform = false;
      
      if (!isUniform) {
         const bx = x * cellSize + minBoxX;
         const bz = z * cellSize + minBoxZ;
         for (let dz = -cellRadius; dz <= cellRadius; dz++) {
           for (let dx = -cellRadius; dx <= cellRadius; dx++) {
             const ix = x + dx;
             const iz = z + dz;
             if (ix >= 0 && ix < resX && iz >= 0 && iz < resZ) {
                const px = ix * cellSize + minBoxX;
                const pz = iz * cellSize + minBoxZ;
                const distSq = (px - bx)**2 + (pz - bz)**2;
                if (distSq <= R * R) {
                   const idx = getIdx(ix, iz);
                   C[idx] = Math.max(C[idx], h + Math.sqrt(R * R - distSq));
                }
             }
           }
         }
      }
    }
  }

  const E = new Float32Array(arraySize).fill(10000);
  const erosionOffsets = [];
  for (let dz = -cellRadius; dz <= cellRadius; dz++) {
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const distSq = (dx * cellSize)**2 + (dz * cellSize)**2;
        if (distSq <= R * R) {
           erosionOffsets.push({ dx, dz, hOffset: Math.sqrt(R*R - distSq) });
        }
    }
  }

  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      let minH = 10000;
      for (let i = 0; i < erosionOffsets.length; i++) {
         const offset = erosionOffsets[i];
         const ix = x + offset.dx;
         const iz = z + offset.dz;
         if (ix >= 0 && ix < resX && iz >= 0 && iz < resZ) {
            const val = C[getIdx(ix, iz)] - offset.hOffset;
            if (val < minH) minH = val;
         } else {
            const val = R - offset.hOffset;
            if (val < minH) minH = val;
         }
      }
      E[getIdx(x, z)] = Math.max(Math.max(minH, H[getIdx(x, z)]), 0);
    }
  }

  // Create geometry using explicit width/height
  const geometry = new THREE.PlaneGeometry(gridSizeX, gridSizeZ, resX - 1, resZ - 1);
  geometry.rotateX(-Math.PI / 2);
  
  const positions = geometry.attributes.position.array;
  for (let z = 0; z < resZ; z++) {
    for (let x = 0; x < resX; x++) {
      const vertexIdx = (z * resX + x) * 3;
      positions[vertexIdx] = x * cellSize + minBoxX;
      positions[vertexIdx + 1] = E[getIdx(x, z)];
      positions[vertexIdx + 2] = z * cellSize + minBoxZ;
    }
  }
  
  geometry.computeVertexNormals();
  return geometry;
}
