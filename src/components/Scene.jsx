import React, { useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Edges, TransformControls } from '@react-three/drei';
import { generateZPRMesh } from '../utils/RollingSphere';

export default function Scene({ 
  masts, setMasts, 
  conductors, setConductors,
  buildings, setBuildings,
  boxes,
  interactionMode, setInteractionMode,
  protectionRadius,
  selectedIds, setSelectedIds,
  systemMode,
  pushState,
  clipX, clipY, clipZ,
  zprOffset, setZprOffset,
  onUpdatePositions
}) {
  const [hoveredPos, setHoveredPos] = useState(null);
  const [tempConductorStart, setTempConductorStart] = useState(null);
  
  const clipPlanes = useMemo(() => {
    const planes = [];
    if (clipX < 100) planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipX));
    if (clipY < 100) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY));
    if (clipZ < 100) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), clipZ));
    return planes;
  }, [clipX, clipY, clipZ]);
  
  const defaultBuildingSize = [15, 10, 15];
  const defaultMastHeight = 0.6; // Smaller default mast to 0.6m per user reference

  const handlePointerMove = (e) => {
    if (interactionMode === 'select' || interactionMode === 'pan') {
      setHoveredPos(null);
      return;
    }
    e.stopPropagation();
    
    let point = e.point.clone();
    
    // Magnetic Snapping for masts and conductors (snap to building top corners/edges)
    if (interactionMode === 'add-mast' || interactionMode === 'add-conductor') {
      let closestDist = 2.0; // snap threshold
      let snappedPt = null;
      for (const b of buildings) {
        const topY = b.position[1] + b.size[1] / 2;
        const hw = b.size[0] / 2;
        const hd = b.size[2] / 2;
        const corners = [
          [b.position[0] - hw, topY, b.position[2] - hd],
          [b.position[0] + hw, topY, b.position[2] - hd],
          [b.position[0] - hw, topY, b.position[2] + hd],
          [b.position[0] + hw, topY, b.position[2] + hd]
        ];
        
        for (const c of corners) {
          // Snap based strictly on 2D proximity on the screen/plane ignore Y altitude offset of mouse
          const dx = point.x - c[0];
          const dz = point.z - c[2];
          const dXY = Math.sqrt(dx*dx + dz*dz);
          
          if (dXY < closestDist) {
            closestDist = dXY;
            snappedPt = new THREE.Vector3(c[0], c[1], c[2]);
          }
        }
      }
      if (snappedPt) point.copy(snappedPt);
    }
    setHoveredPos(point);
  };

  const handleClick = (e) => {
    if (interactionMode === 'select' || interactionMode === 'pan') {
      if (!e.ctrlKey && !e.metaKey) setSelectedIds([]);
      return;
    }
    
    e.stopPropagation();
    const point = e.point;

    if (interactionMode === 'add-building' || interactionMode === 'add-volume') {
      const id = Date.now();
      pushState();
      setBuildings((prev) => [
        ...prev,
        {
          id,
          position: [point.x, point.y + defaultBuildingSize[1] / 2, point.z],
          size: defaultBuildingSize,
          roofType: 'flat',
          protrusion: 'none',
          buildingType: interactionMode === 'add-building' ? 'building' : 'volume'
        }
      ]);
      setSelectedIds([id]);
      setInteractionMode('select');
    } else if (interactionMode === 'add-mast') {
      const id = Date.now();
      pushState();
      setMasts((prev) => [
        ...prev,
        {
          id,
          position: [point.x, point.y, point.z],
          height: defaultMastHeight
        }
      ]);
      setSelectedIds([id]);
      setInteractionMode('select');
    } else if (interactionMode === 'add-conductor') {
      if (!tempConductorStart) {
        setTempConductorStart([point.x, point.y, point.z]);
      } else {
        const id = Date.now();
        pushState();
        setConductors((prev) => [
          ...prev,
          {
            id,
            points: [tempConductorStart, [point.x, point.y, point.z]]
          }
        ]);
        setTempConductorStart(null);
        setInteractionMode('select');
      }
    }
  };

  const handleObjectClick = (e, id) => {
    if (interactionMode === 'select' || interactionMode === 'pan') {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
         setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      } else {
         setSelectedIds([id]);
      }
    }
  };

  const updatePosition = (id, newPos, type, delta) => {
    if (onUpdatePositions) {
       onUpdatePositions(id, newPos, type, delta);
    }
  };

  const updateZprPosition = (newPos, delta) => {
    setZprOffset([
      zprOffset[0] + delta.x,
      zprOffset[1] + delta.y,
      zprOffset[2] + delta.z
    ]);
  };

  return (
    <group onPointerMove={handlePointerMove} onClick={handleClick}>
      {interactionMode !== 'select' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} visible={false}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial />
        </mesh>
      )}

      {/* Render Buildings */}
      {buildings.map((b) => (
        <DraggableBuilding 
          key={b.id} 
          b={b} 
          isSelected={selectedIds.includes(b.id)}
          isPrimary={selectedIds[selectedIds.length - 1] === b.id}
          onClick={(e) => handleObjectClick(e, b.id)} 
          onUpdate={updatePosition}
          onDragStart={pushState}
        />
      ))}

      {/* Render Masts */}
      {masts.map((m) => (
        <DraggableMast 
          key={m.id} 
          m={m} 
          isSelected={selectedIds.includes(m.id)}
          isPrimary={selectedIds[selectedIds.length - 1] === m.id}
          onClick={(e) => handleObjectClick(e, m.id)} 
          onUpdate={updatePosition}
          onDragStart={pushState}
        />
      ))}

      {/* Render Conductors */}
      {conductors.map((c) => (
        <DraggableConductor 
          key={c.id} 
          c={c} 
          isSelected={selectedIds.includes(c.id)}
          isPrimary={selectedIds[selectedIds.length - 1] === c.id}
          onClick={(e) => handleObjectClick(e, c.id)}
          onUpdate={updatePosition}
          onDragStart={pushState}
        />
      ))}

      {/* Render Inspection Boxes */}
      {boxes && boxes.map((bx, i) => {
        // Rotates the box slightly if we know the offset (so it faces outward from wall properly)
        const angle = bx.offset ? Math.atan2(bx.offset[0], bx.offset[1]) : 0;
        return (
          <group key={'box'+i} position={bx.position} rotation={[0, angle, 0]}>
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[0.2, 0.25, 0.15]} />
              <meshStandardMaterial color="#475569" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.08]} rotation={[0, 0, 0]}>
              <planeGeometry args={[0.15, 0.2]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          </group>
        );
      })}

      {/* Rolling Sphere Evaluation Mode */}
      {systemMode === 'analyze' && (
        <DraggableZPRMesh 
          buildings={buildings} 
          masts={masts} 
          conductors={conductors} 
          r={protectionRadius} 
          clipPlanes={clipPlanes} 
          zprOffset={zprOffset}
          isSelected={selectedIds.includes('ZPR_MESH')}
          isPrimary={selectedIds[selectedIds.length - 1] === 'ZPR_MESH'}
          onClick={(e) => handleObjectClick(e, 'ZPR_MESH')}
          onUpdate={updateZprPosition}
        />
      )}

      {hoveredPos && (interactionMode === 'add-building' || interactionMode === 'add-volume') && (
        <mesh position={[hoveredPos.x, defaultBuildingSize[1] / 2, hoveredPos.z]}>
          <boxGeometry args={defaultBuildingSize} />
          <meshBasicMaterial color={interactionMode === 'add-building' ? "#4f46e5" : "#64748b"} wireframe transparent opacity={0.5} />
        </mesh>
      )}
      {hoveredPos && interactionMode === 'add-mast' && (
        <mesh position={[hoveredPos.x, hoveredPos.y + defaultMastHeight / 2, hoveredPos.z]}>
          <cylinderGeometry args={[0.05, 0.1, defaultMastHeight, 8]} />
          <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.5} />
        </mesh>
      )}
      {hoveredPos && interactionMode === 'add-conductor' && (
        <>
          <mesh position={[hoveredPos.x, hoveredPos.y, hoveredPos.z]}>
            <sphereGeometry args={[0.3]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          {tempConductorStart && (
            <LinePreview start={tempConductorStart} end={[hoveredPos.x, hoveredPos.y, hoveredPos.z]} />
          )}
        </>
      )}
    </group>
  );
}

function DraggableBuilding({ b, isSelected, isPrimary, onClick, onUpdate, onDragStart }) {
  const ref = React.useRef();
  const controls = useThree(state => state.controls);
  const [initialPos, setInitialPos] = useState(null);
  
  return isSelected && isPrimary ? (
    <TransformControls 
      mode="translate" 
      position={b.position} 
      onMouseDown={(e) => { 
        if (onDragStart) onDragStart(); 
        setInitialPos(e.target.object.position.clone()); 
      }}
      onMouseUp={(e) => {
        const delta = initialPos ? e.target.object.position.clone().sub(initialPos) : new THREE.Vector3();
        onUpdate(b.id, e.target.object.position, 'building', delta);
      }}
      onDraggingChanged={(e) => { if (controls) controls.enabled = !e.value; }}
    >
      <group ref={ref}>
        <BuildingModel b={b} isSelected={true} onClick={onClick} />
      </group>
    </TransformControls>
  ) : (
    <group position={b.position}>
      <BuildingModel b={b} isSelected={isSelected} onClick={onClick} />
    </group>
  );
}

function DraggableMast({ m, isSelected, isPrimary, onClick, onUpdate, onDragStart }) {
  const ref = React.useRef();
  const controls = useThree(state => state.controls);
  const [initialPos, setInitialPos] = useState(null);

  return isSelected && isPrimary ? (
    <TransformControls 
      mode="translate" 
      position={m.position} 
      onMouseDown={(e) => { 
        if (onDragStart) onDragStart(); 
        setInitialPos(e.target.object.position.clone()); 
      }}
      onMouseUp={(e) => {
        const delta = initialPos ? e.target.object.position.clone().sub(initialPos) : new THREE.Vector3();
        onUpdate(m.id, e.target.object.position, 'mast', delta);
      }}
      onDraggingChanged={(e) => { if (controls) controls.enabled = !e.value; }}
    >
      <group ref={ref}>
        <MastModel m={m} isSelected={true} onClick={onClick} />
      </group>
    </TransformControls>
  ) : (
    <group position={m.position}>
      <MastModel m={m} isSelected={isSelected} onClick={onClick} />
    </group>
  );
}

function DraggableConductor({ c, isSelected, isPrimary, onClick, onUpdate, onDragStart }) {
  const ref = React.useRef();
  const controls = useThree(state => state.controls);
  const [initialPos, setInitialPos] = useState(null);

  const p1 = new THREE.Vector3(...c.points[0]);
  const p2 = new THREE.Vector3(...c.points[1]);
  const centerPos = p1.clone().lerp(p2, 0.5);

  return isSelected && isPrimary ? (
    <TransformControls 
      mode="translate" 
      position={centerPos} 
      onMouseDown={(e) => { 
        if (onDragStart) onDragStart(); 
        setInitialPos(e.target.object.position.clone()); 
      }}
      onMouseUp={(e) => {
        const delta = initialPos ? e.target.object.position.clone().sub(initialPos) : new THREE.Vector3();
        onUpdate(c.id, e.target.object.position, 'conductor', delta);
      }}
      onDraggingChanged={(e) => { if (controls) controls.enabled = !e.value; }}
    >
      <group ref={ref}>
        <ConductorModel c={c} isSelected={true} onClick={onClick} />
      </group>
    </TransformControls>
  ) : (
    <group position={[0,0,0]}>
      <ConductorModel c={c} isSelected={isSelected} onClick={onClick} />
    </group>
  );
}

function BuildingModel({ b, isSelected, onClick }) {
  const matColor = isSelected ? '#bfdbfe' : '#e2e8f0'; // Clean architectural white
  const edgeColor = isSelected ? '#2563eb' : '#cbd5e1';
  const isCylinder = b.buildingShape === 'cylinder';
  
  const h2 = b.size[1] / 2;
  const w = b.size[0];
  const d = b.size[2];
  const roofHeight = b.size[1] * 0.4; // 40% of building height extra for roofs

  const longestIsX = w >= d;
  const L = longestIsX ? w : d;
  const W = longestIsX ? d : w;

  // Extrude triangles for Gable
  const gableShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0);
    s.lineTo(0, roofHeight);
    s.lineTo(W / 2, 0);
    s.lineTo(-W / 2, 0);
    return s;
  }, [W, roofHeight]);

  const gableExtrudeArgs = useMemo(() => [gableShape, { depth: L, bevelEnabled: false }], [gableShape, L]);

  // Procedural Window Generation (Modern Minimalist Sketch Style)
  const floorHeight = 3;
  const numFloors = Math.max(1, Math.floor(b.size[1] / floorHeight));
  const winH = 1.3; // Elegant height constraint for the glass
  
  const windows = [];
  const isBuilding = !b.buildingType || b.buildingType === 'building';
  
  if (!isCylinder && isBuilding && (b.roofType === 'flat' || b.roofType === 'gable' || b.roofType === 'cylinder')) {
    for (let f = 0; f < numFloors; f++) {
        const fy = (f + 0.5) * floorHeight - h2;
        
        // Two distinct columns per facade for modernist window sets
        const winW_X = (w * 0.8) / 2; 
        const winW_Z = (d * 0.8) / 2;
        const xOffset = winW_X / 2 + 0.2; 
        const zOffset = winW_Z / 2 + 0.2;
        
        // Front & Back
        windows.push(<mesh key={`f${f}F_L`} position={[-xOffset, fy, d/2 + 0.01]}><planeGeometry args={[winW_X, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        windows.push(<mesh key={`f${f}F_R`} position={[xOffset, fy, d/2 + 0.01]}><planeGeometry args={[winW_X, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        windows.push(<mesh key={`f${f}B_L`} position={[-xOffset, fy, -d/2 - 0.01]} rotation={[0, Math.PI, 0]}><planeGeometry args={[winW_X, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        windows.push(<mesh key={`f${f}B_R`} position={[xOffset, fy, -d/2 - 0.01]} rotation={[0, Math.PI, 0]}><planeGeometry args={[winW_X, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        
        // Left & Right
        windows.push(<mesh key={`f${f}L_F`} position={[-w/2 - 0.01, fy, zOffset]} rotation={[0, -Math.PI/2, 0]}><planeGeometry args={[winW_Z, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        windows.push(<mesh key={`f${f}L_B`} position={[-w/2 - 0.01, fy, -zOffset]} rotation={[0, -Math.PI/2, 0]}><planeGeometry args={[winW_Z, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        windows.push(<mesh key={`f${f}R_F`} position={[w/2 + 0.01, fy, zOffset]} rotation={[0, Math.PI/2, 0]}><planeGeometry args={[winW_Z, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
        windows.push(<mesh key={`f${f}R_B`} position={[w/2 + 0.01, fy, -zOffset]} rotation={[0, Math.PI/2, 0]}><planeGeometry args={[winW_Z, winH]} /><meshPhysicalMaterial color="#0b1320" roughness={0.1} metalness={0.9} envMapIntensity={2.0} clearcoat={1.0}/></mesh>);
    }
  }

  const protSize = b.protSize || [3, 2, 3];
  const protOffset = b.protOffset || [0, 0];

  return (
    <group onClick={onClick}>
      {/* Main Body */}
      <mesh castShadow receiveShadow>
        {isCylinder ? (
           <cylinderGeometry args={[Math.max(w,d)/2, Math.max(w,d)/2, b.size[1], 32]} />
        ) : (
           <boxGeometry args={[w, b.size[1], d]} />
        )}
        <meshPhysicalMaterial color={matColor} roughness={0.8} clearcoat={0.1} envMapIntensity={0.5} />
        <Edges scale={1.001} threshold={15} color={edgeColor} />
      </mesh>
      
      {/* Procedural Windows */}
      {windows}

      {/* Roof types */}
      {b.roofType === 'gable' && (
        <mesh position={[longestIsX ? L / 2 : 0, h2, longestIsX ? 0 : -L / 2]} rotation={[0, longestIsX ? -Math.PI / 2 : 0, 0]} castShadow receiveShadow>
          <extrudeGeometry args={gableExtrudeArgs} />
          <meshPhysicalMaterial color={matColor} roughness={0.85} envMapIntensity={0.5} />
          <Edges scale={1.001} threshold={15} color={edgeColor} />
        </mesh>
      )}
      {b.roofType === 'cylinder' && (
        <mesh position={[0, h2, 0]} rotation={[0, longestIsX ? 0 : Math.PI / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[W/2, W/2, L, 32, 1, false, Math.PI / 2, Math.PI]} />
          <meshPhysicalMaterial color={matColor} roughness={0.85} envMapIntensity={0.5} side={THREE.DoubleSide} />
          <Edges scale={1.001} threshold={15} color={edgeColor} />
        </mesh>
      )}

      {/* Protrusions */}
      {b.protrusion === 'box' && (
        <mesh position={[protOffset[0], h2 + protSize[1]/2, protOffset[1]]} castShadow receiveShadow>
          <boxGeometry args={protSize} />
          <meshStandardMaterial color={matColor} roughness={0.8} envMapIntensity={0.2} />
          <Edges scale={1.001} threshold={15} color={edgeColor} />
        </mesh>
      )}
      {b.protrusion === 'chimney' && (
        <mesh position={[protOffset[0], h2 + protSize[1]/2, protOffset[1]]} castShadow receiveShadow>
          <cylinderGeometry args={[protSize[0]/2, protSize[0]/2, protSize[1], 16]} />
          <meshStandardMaterial color={matColor} roughness={0.8} envMapIntensity={0.2} />
          <Edges scale={1.001} threshold={15} color={edgeColor} />
        </mesh>
      )}
    </group>
  );
}

function MastModel({ m, isSelected, onClick }) {
  const color = isSelected ? "#f59e0b" : "#333333";
  const rTop = 0.02;
  const rBot = 0.05;
  
  return (
    <group position={[0, m.height / 2, 0]} onClick={onClick}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[rTop, rBot, m.height, 16]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} envMapIntensity={1.5} />
      </mesh>
      {/* Invisible thicker interaction cylinder for much easier clicking */}
      <mesh visible={false}>
        <cylinderGeometry args={[0.3, 0.3, m.height, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

function ConductorModel({ c, isSelected, onClick }) {
  const p1 = new THREE.Vector3(...c.points[0]);
  const p2 = new THREE.Vector3(...c.points[1]);
  const distance = p1.distanceTo(p2);
  const position = p1.clone().lerp(p2, 0.5);
  
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    p2.clone().sub(p1).normalize()
  );

  const isGround = c.type === 'ground';
  const isRing = isGround && Math.abs(p1.y - p2.y) < 0.05; // is it horizontal underground?
  
  const selectedColor = "#3b82f6";
  const meshColor = isSelected ? selectedColor : (isGround ? "#d97755" : "#f8fafc");

  return (
    <group position={position} quaternion={quaternion} onClick={onClick}>
      <mesh castShadow receiveShadow>
        {isGround ? (
          <cylinderGeometry args={[0.06, 0.06, distance, 16]} />
        ) : (
          <boxGeometry args={[0.3, distance, 0.06]} />
        )}
        
        <meshStandardMaterial color={meshColor} metalness={1.0} roughness={0.12} envMapIntensity={1.8} />
      </mesh>
      
      {/* Invisible interaction hit box for easier clicking on lines */}
      <mesh visible={false}>
          <cylinderGeometry args={[0.4, 0.4, distance, 8]} />
          <meshBasicMaterial />
      </mesh>

      {/* Trench (Valeta) dug into exactly the dirt around the Ring */}
      {isRing && (
        <group>
           {/* Bottom dirt under copper */}
           <mesh position={[0, 0, -0.04]} receiveShadow>
             <boxGeometry args={[0.4, distance, 0.02]} />
             <meshStandardMaterial color="#3e2723" roughness={1.0} />
           </mesh>
           {/* Left dirt wall */}
           <mesh position={[0.2, 0, 0.15]} receiveShadow>
             <boxGeometry args={[0.04, distance, 0.4]} />
             <meshStandardMaterial color="#4e342e" roughness={1.0} />
           </mesh>
           {/* Right dirt wall */}
           <mesh position={[-0.2, 0, 0.15]} receiveShadow>
             <boxGeometry args={[0.04, distance, 0.4]} />
             <meshStandardMaterial color="#4e342e" roughness={1.0} />
           </mesh>
        </group>
      )}
    </group>
  );
}

function LinePreview({ start, end }) {
  const p1 = new THREE.Vector3(...start);
  const p2 = new THREE.Vector3(...end);
  const distance = p1.distanceTo(p2);
  const position = p1.clone().lerp(p2, 0.5);
  
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    p2.clone().sub(p1).normalize()
  );

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.04, 0.04, distance, 8]} />
      <meshBasicMaterial color="#10b981" transparent opacity={0.6} />
    </mesh>
  );
}

function DraggableZPRMesh({ buildings, masts, conductors, r, clipPlanes, zprOffset, isSelected, isPrimary, onClick, onUpdate }) {
  const ref = React.useRef();
  const controls = useThree(state => state.controls);
  const [initialPos, setInitialPos] = useState(null);

  return isSelected && isPrimary ? (
    <TransformControls 
      mode="translate" 
      position={zprOffset} 
      onMouseDown={(e) => { 
        setInitialPos(e.target.object.position.clone()); 
      }}
      onMouseUp={(e) => {
        const delta = initialPos ? e.target.object.position.clone().sub(initialPos) : new THREE.Vector3();
        onUpdate(e.target.object.position, delta);
      }}
      onDraggingChanged={(e) => { if (controls) controls.enabled = !e.value; }}
    >
      <group ref={ref}>
        <TrueZPRMesh 
           buildings={buildings} masts={masts} conductors={conductors} r={r} clipPlanes={clipPlanes} 
           isSelected={true} onClick={onClick} />
      </group>
    </TransformControls>
  ) : (
    <group position={zprOffset}>
      <TrueZPRMesh 
          buildings={buildings} masts={masts} conductors={conductors} r={r} clipPlanes={clipPlanes} 
          isSelected={isSelected} onClick={onClick} />
    </group>
  );
}

function TrueZPRMesh({ buildings, masts, conductors, r, clipPlanes, isSelected, onClick }) {
  const geom = useMemo(() => {
    return generateZPRMesh(buildings, masts, conductors, r);
  }, [buildings, masts, conductors, r]);

  const outlineColor = isSelected ? "#3b82f6" : "#ef4444";
  const opacity = isSelected ? 0.6 : 0.4;
  const solidOpacity = isSelected ? 0.4 : 0.3;

  // Malha avermelhada trançada/translúcida com clipping plane opcional
  return (
    <group onClick={onClick}>
      {/* Wireframe overlay to look like a mesh */}
      <mesh geometry={geom} position={[0, 0.1, 0]}>
        <meshBasicMaterial color={outlineColor} wireframe={true} transparent opacity={opacity} clippingPlanes={clipPlanes} depthWrite={false} />
      </mesh>
      {/* Fast AAA-tier Translucency without Refraction Pass penalty */}
      <mesh geometry={geom} position={[0, 0.1, 0]}>
        <meshStandardMaterial 
          color={outlineColor} 
          transparent 
          opacity={solidOpacity} 
          roughness={0.4}
          metalness={0.2}
          side={THREE.DoubleSide}
          clippingPlanes={clipPlanes}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
