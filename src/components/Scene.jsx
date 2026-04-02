import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Edges, TransformControls, Html } from '@react-three/drei';
import { generateZPRMesh } from '../utils/RollingSphere';

/* --- CORE SCENE GRAPH (Apex Restoration v2025) --- */

export default function Scene({ 
  masts, setMasts, buildings, setBuildings, conductors, setConductors,
  roads, trees, poles, cars, people, interactionMode, setInteractionMode,
  protectionRadius, selectedIds, setSelectedIds, systemMode, pushState,
  clipRef, zprOpacity, hoveredPos, setHoveredPos, rulerPoints, setRulerPoints,
  dimensions, setDimensions
}) {
  const { zprPayload } = useMemo(() => {
    if (systemMode !== 'analyze') return { zprPayload: null };
    return { zprPayload: generateZPRMesh(buildings, masts, conductors, protectionRadius) };
  }, [buildings, masts, conductors, protectionRadius, systemMode]);

  const getSurfaceHeight = (x, z, excludeId = null) => {
    let maxHeight = 0;
    for (const b of buildings) {
      if (b.id === excludeId) continue;
      const hw = b.size[0] / 2;
      const hd = b.size[1] / 2;
      if (x >= b.position[0] - hw && x <= b.position[0] + hw && 
          z >= b.position[2] - hd && z <= b.position[2] + hd) {
        const topY = b.position[1] + b.size[2] / 2;
        if (topY > maxHeight) maxHeight = topY;
      }
    }
    return maxHeight;
  };

  const handleClick = (e) => {
    if (interactionMode === 'select') return;
    e.stopPropagation();
    const p = e.point;
    
    if (interactionMode === 'add-building') {
      const id = Date.now();
      pushState();
      setBuildings(prev => [...prev, { id, position: [p.x, 5, p.z], size: [14, 14, 12], roofType: 'flat', buildingType: 'building' }]);
      setInteractionMode('select');
    } else if (interactionMode === 'add-mast') {
      const id = Date.now();
      pushState();
      setMasts(prev => [...prev, { id, position: [p.x, p.y, p.z], height: 2.5 }]);
      setInteractionMode('select');
    } else if (interactionMode === 'ruler') {
      const snapP = [p.x, p.y + 0.1, p.z];
      if (rulerPoints.length === 0) setRulerPoints([snapP]);
      else {
        setDimensions(prev => [...prev, { id: Date.now(), start: rulerPoints[0], end: snapP }]);
        setRulerPoints([]);
      }
    }
  };

  const updatePosition = (id, newPos, type, delta) => {
    const surfaceY = getSurfaceHeight(newPos.x, newPos.z, type === 'building' ? id : null);
    let finalPos = { ...newPos };
    if (type === 'building') {
       const bObj = buildings.find(x => x.id === id);
       const h = bObj ? bObj.size[2] : 10;
       finalPos.y = h/2; // Grounded building
    } else {
       finalPos.y = surfaceY; // Snaps to building roofs or ground
    }
    onUpdatePositions(id, finalPos, type, delta);
  };

  return (
    <group onPointerMove={(e) => setHoveredPos(e.point)}>
       <TechnicalController systemMode={systemMode} clipRef={clipRef} />
       
       <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleClick} position={[0, -0.01, 0]}>
         <planeGeometry args={[2000, 2000]} />
         <meshStandardMaterial color="#344e41" roughness={1} metalness={0} />
       </mesh>

       {buildings.map(b => (
         <DraggableBuilding key={b.id} b={b} isSelected={selectedIds.includes(b.id)} isPrimary={selectedIds[selectedIds.length-1] === b.id} onUpdate={updatePosition} onClick={() => setSelectedIds([b.id])} />
       ))}

       {masts.map(m => (
         <DraggableMast key={m.id} m={m} isSelected={selectedIds.includes(m.id)} isPrimary={selectedIds[selectedIds.length-1] === m.id} onUpdate={updatePosition} onClick={() => setSelectedIds([m.id])} />
       ))}

       {roads && roads.map(r => <RoadModel key={r.id} r={r} />)}
       {trees && trees.map(t => <TreeModel key={t.id} t={t} />)}
       {poles && poles.map(p => (
         <React.Fragment key={p.id}>
           <PoleModel p={p} />
           {buildings.length > 0 && (() => {
              const b = buildings[0]; // Connect to 1st building as in screenshot
              return <ServiceDrop start={[p.position[0], 8.5, p.position[2]]} end={[b.position[0] - b.size[0]/2, b.position[1] + b.size[2]/2, b.position[2]]} />;
           })()}
         </React.Fragment>
       ))}
       {cars && cars.map(c => <CarModel key={c.id} c={c} />)}

       {systemMode === 'analyze' && zprPayload && (
         <TrueZPRMesh zprPayload={zprPayload} clipRef={clipRef} protectionRadius={protectionRadius} zprOpacity={zprOpacity} />
       )}

       {dimensions && dimensions.map(d => <Dimension key={d.id} start={d.start} end={d.end} onRemove={() => setDimensions(prev => prev.filter(x => x.id !== d.id))} />)}
       {rulerPoints.length > 0 && hoveredPos && <Dimension start={rulerPoints[0]} end={[hoveredPos.x, hoveredPos.y, hoveredPos.z]} isPreview={true} />}
    </group>
  );
}

function TechnicalController({ systemMode, clipRef }) {
  const { camera } = useThree();
  useFrame((state) => {
    if (systemMode !== 'analyze') return;
    // Section cut shimmering logic could go here if needed
  });
  return null;
}

function ServiceDrop({ start, end }) {
  const p1 = new THREE.Vector3(...start);
  const p2 = new THREE.Vector3(...end);
  const len = p1.distanceTo(p2);
  const pos = p1.clone().lerp(p2, 0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
  return (
    <mesh position={pos} quaternion={quat}>
       <cylinderGeometry args={[0.012, 0.012, len, 6]} />
       <meshBasicMaterial color="#111" />
    </mesh>
  );
}

function DraggableBuilding({ b, isSelected, isPrimary, onUpdate, onClick }) {
  const controls = useThree(s => s.controls);
  const [initialPos, setInitialPos] = useState(null);
  return isSelected && isPrimary ? (
    <TransformControls 
      position={b.position} 
      showY={false}
      onMouseDown={(e) => setInitialPos(e.target.object.position.clone())}
      onMouseUp={(e) => {
        const delta = initialPos ? e.target.object.position.clone().sub(initialPos) : new THREE.Vector3();
        onUpdate(b.id, e.target.object.position, 'building', delta);
      }}
      onDraggingChanged={e => { if (controls) controls.enabled = !e.value; }}
      onObjectChange={e => { e.target.object.position.y = b.size[2]/2; }}
    >
      <BuildingModel b={b} isSelected={true} onClick={onClick} />
    </TransformControls>
  ) : <BuildingModel b={b} isSelected={isSelected} onClick={onClick} />;
}

function BuildingModel({ b, isSelected, onClick }) {
  return (
    <mesh position={b.position} onClick={onClick} castShadow receiveShadow>
      <boxGeometry args={b.size} />
      <meshStandardMaterial color={isSelected ? "#bfdbfe" : "#f8fafc"} roughness={0.6} />
      <Edges color="#2563eb" threshold={15} />
      
      {/* PROFESSIONAL WINDOW STRIPS (As seen in screenshot) */}
      {[0,1,2,3].map(face => (
          <group key={face} rotation={[0, face * Math.PI/2, 0]}>
             {[0, 1, 2].map(flo => (
               <group key={flo} position={[0, -b.size[2]/2 + 2.5 + flo*3, b.size[1]/2 + 0.02]}>
                  {/* Each floor has horizontal black glass strips */}
                  <mesh position={[0, 0, 0]}>
                    <planeGeometry args={[b.size[0]*0.85, 1.4]} />
                    <meshBasicMaterial color="#000" />
                  </mesh>
               </group>
             ))}
          </group>
      ))}
    </mesh>
  );
}

function DraggableMast({ m, isSelected, isPrimary, onUpdate, onClick }) {
  const controls = useThree(s => s.controls);
  const [initialPos, setInitialPos] = useState(null);
  return isSelected && isPrimary ? (
    <TransformControls 
      position={m.position} 
      showY={false}
      onMouseDown={(e) => setInitialPos(e.target.object.position.clone())}
      onMouseUp={(e) => {
        const delta = initialPos ? e.target.object.position.clone().sub(initialPos) : new THREE.Vector3();
        onUpdate(m.id, e.target.object.position, 'mast', delta);
      }}
      onDraggingChanged={e => { if (controls) controls.enabled = !e.value; }}
    >
      <MastModel m={m} isSelected={true} onClick={onClick} />
    </TransformControls>
  ) : <MastModel m={m} isSelected={isSelected} onClick={onClick} />;
}

function MastModel({ m, isSelected, onClick }) {
  return (
     <group position={m.position} onClick={onClick}>
        <mesh position={[0, m.height/2, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, m.height, 12]} />
          <meshStandardMaterial color={isSelected ? "#3b82f6" : "#cbd5e1"} metalness={0.98} roughness={0.02} />
        </mesh>
        <mesh position={[0, m.height, 0]}>
           <sphereGeometry args={[0.08, 16, 16]} />
           <meshStandardMaterial color={isSelected ? "#3b82f6" : "#475569"} metalness={1} />
        </mesh>
     </group>
  );
}

function RoadModel({ r }) {
  const p1 = new THREE.Vector3(...r.points[0]);
  const p2 = new THREE.Vector3(...r.points[1]);
  const len = p1.distanceTo(p2);
  const center = p1.clone().lerp(p2, 0.5);
  const ang = Math.atan2(p2.x - p1.x, p2.z - p1.z);
  return (
    <group position={center} rotation={[0, ang + Math.PI/2, 0]}>
       <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[len, r.roadWidth]} />
          <meshStandardMaterial color="#1e293b" />
       </mesh>
       <mesh position={[0, 0.015, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[len, 0.15]} />
          <meshBasicMaterial color="#fbbf24" />
       </mesh>
       {/* Curbs */}
       {[-1, 1].map(side => (
         <mesh key={side} position={[0, 0.1, side * (r.roadWidth/2 + 2.5)]}>
            <boxGeometry args={[len, 0.2, 5]} />
            <meshStandardMaterial color="#94a3b8" />
         </mesh>
       ))}
    </group>
  );
}

function PoleModel({ p }) {
  return (
    <group position={p.position}>
       {/* Concrete Concrete Pole */}
       <mesh position={[0, 4.5, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.25, 9, 8]} />
          <meshStandardMaterial color="#94a3b8" />
       </mesh>
       {/* Crossbar */}
       <mesh position={[0, 8.5, 0]}>
          <boxGeometry args={[3, 0.15, 0.15]} />
          <meshStandardMaterial color="#474747" />
       </mesh>
       {/* TRANSFORMER BOX (As seen in screenshot) */}
       <mesh position={[0.6, 6.5, 0]}>
          <boxGeometry args={[1, 1.4, 0.8]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} />
       </mesh>
    </group>
  );
}

function CarModel({ c }) {
  return (
    <group position={c.position} rotation={[0, c.rotation || 0, 0]}>
       <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={c.type === 'bus' ? [2.8, 3.8, 10] : [2.2, 1.4, 5]} />
          <meshStandardMaterial color={c.type === 'bus' ? "#3b82f6" : "#64748b"} />
       </mesh>
    </group>
  );
}

function TreeModel({ t }) {
  return (
    <group position={t.position} scale={t.scale || 1.3}>
       <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.28, 3, 8]} />
          <meshStandardMaterial color="#451a03" roughness={1} />
       </mesh>
       <mesh position={[0, 5, 0]} castShadow>
          <sphereGeometry args={[2.5, 16, 16]} />
          <meshStandardMaterial color="#14532d" />
       </mesh>
    </group>
  );
}

function Dimension({ start, end, isPreview, onRemove }) {
  const p1 = new THREE.Vector3(...start);
  const p2 = new THREE.Vector3(...end);
  const dist = p1.distanceTo(p2);
  const center = p1.clone().lerp(p2, 0.5);
  const dir = p2.clone().sub(p1).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <group>
      <mesh position={center} quaternion={quat} renderOrder={999}>
        <cylinderGeometry args={[0.018, 0.018, dist, 8]} />
        <meshBasicMaterial color="#fbbf24" depthTest={false} transparent opacity={isPreview ? 0.6 : 1.0} />
      </mesh>
      {/* REFINED SLANTED CAD TICKS */}
      {[p1, p2].map((p, i) => (
         <mesh key={i} position={[p.x, p.y, p.z]} quaternion={quat} rotation={[Math.PI/4, 0, 0]}>
            <boxGeometry args={[0.6, 0.015, 0.015]} />
            <meshBasicMaterial color="#fbbf24" depthTest={false} />
         </mesh>
      ))}
      <Html position={[center.x, center.y + 0.6, center.z]} center>
         <div onClick={onRemove} className="dimension-label" style={{ background: '#020617', color: '#fbbf24', padding: '8px 16px', borderRadius: '10px', fontSize: '15px', fontWeight: '900', border: '2.5px solid #fbbf24', cursor: isPreview ? 'default' : 'pointer', pointerEvents: isPreview ? 'none' : 'auto', whiteSpace: 'nowrap', boxShadow: '0 12px 48px rgba(0,0,0,0.9)' }}>
           {dist.toFixed(4)} m
         </div>
      </Html>
    </group>
  );
}

function TrueZPRMesh({ zprPayload, clipRef, protectionRadius, zprOpacity }) {
  const { geometry } = zprPayload;
  const planes = useMemo(() => [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 120),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 120),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 120)
  ], []);

  useFrame(() => {
    planes[0].constant = clipRef.current.x;
    planes[1].constant = clipRef.current.y;
    planes[2].constant = clipRef.current.z;
  });

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
       <meshStandardMaterial 
          color="#3b82f6" 
          transparent 
          opacity={zprOpacity} 
          side={THREE.DoubleSide} 
          clippingPlanes={planes}
          onBeforeCompile={(shader) => {
            shader.uniforms.uRadius = { value: protectionRadius };
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `#include <color_fragment>
               float hVal = clamp(vViewPosition.y / 25.0, 0.0, 1.0);
               diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.5, 0.5), hVal * 0.4);
               if (abs(vViewPosition.x - ${clipRef.current.x}) < 0.25) diffuseColor.rgb = vec3(1.0, 1.0, 1.0) * 3.0;
              `
            );
          }}
       />
    </mesh>
  );
}
