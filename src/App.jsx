import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, Grid, Environment, Sky, ContactShadows, Cloud } from '@react-three/drei';
import { Shield, Box, Plus, Settings2, Trash2, MousePointerSquareDashed, Hand } from 'lucide-react';
import Scene from './components/Scene';

function App() {
  const [protectionLevel, setProtectionLevel] = useState(4); // Default to Nivel IV
  const [masts, setMasts] = useState([]); // { id, position: [x,y,z], height: h }
  const [conductors, setConductors] = useState([]); // { id, points: [[x1,y1,z1], [x2,y2,z2]], type: 'mesh' | 'down' | 'ground' }
  const [buildings, setBuildings] = useState([]); // { id, position: [x,y,z], size: [w,h,d], roofType }
  const [boxes, setBoxes] = useState([]); // { position: [x,y,z] }
  const [interactionMode, setInteractionMode] = useState('select'); // 'select', 'add-mast', 'add-building', 'add-volume', 'add-conductor', 'pan'
  const [systemMode, setSystemMode] = useState('edit'); // 'edit', 'analyze'
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  const [clipboard, setClipboard] = useState([]); // [{ type: 'mast'|'building', data: {} }]
  const [history, setHistory] = useState([]); // Undo stack
  const [clipX, setClipX] = useState(100); // 100 means no clip
  const [clipY, setClipY] = useState(100); // 100 means no clip
  const [clipZ, setClipZ] = useState(100); // 100 means no clip
  const [zprOffset, setZprOffset] = useState([0, 0, 0]);

  const pushState = () => {
    setHistory(prev => {
      const snap = JSON.stringify({ masts, buildings, conductors, boxes });
      if (prev.length > 0 && prev[prev.length - 1] === snap) return prev;
      return [...prev, snap].slice(-30);
    });
  };

  // Keyboard Shortcuts (Copy & Paste & Undo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in a form field
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;

      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        setHistory(prev => {
          if (prev.length === 0) return prev;
          const lastStr = prev[prev.length - 1];
          const last = JSON.parse(lastStr);
          setMasts(last.masts);
          setBuildings(last.buildings);
          setConductors(last.conductors);
          setBoxes(last.boxes);
          return prev.slice(0, -1);
        });
      }

      // Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedIds.length > 0) {
          const copiedData = selectedIds.map(id => {
             const m = masts.find(m => m.id === id);
             if (m) return { type: 'mast', data: m };
             const b = buildings.find(b => b.id === id);
             if (b) return { type: 'building', data: b };
             return null;
          }).filter(Boolean);
          setClipboard(copiedData);
        }
      }

      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          pushState();
          const newIds = [];
          const newMasts = [];
          const newBuildings = [];
          clipboard.forEach(item => {
            const newId = Date.now() + Math.random();
            newIds.push(newId);
            if (item.type === 'mast') {
              newMasts.push({ ...item.data, id: newId, position: [item.data.position[0] + 1.5, item.data.position[1], item.data.position[2] + 1.5] });
            } else if (item.type === 'building') {
              newBuildings.push({ ...item.data, id: newId, position: [item.data.position[0] + 5, item.data.position[1], item.data.position[2] + 5] });
            }
          });
          setMasts(prev => [...prev, ...newMasts]);
          setBuildings(prev => [...prev, ...newBuildings]);
          setSelectedIds(newIds);
        }
      }

      // Nudge with arrow keys
      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key);
      if (isArrowKey && selectedIds.length > 0) {
        e.preventDefault();
        const now = Date.now();
        if (now - (window.lastNudgeTime || 0) > 500) {
           pushState();
        }
        window.lastNudgeTime = now;

        const nudgeAmount = e.shiftKey ? 2.5 : 0.5;
        const delta = { x: 0, y: 0, z: 0 };

        if (e.key === 'ArrowUp') delta.z -= nudgeAmount;
        if (e.key === 'ArrowDown') delta.z += nudgeAmount;
        if (e.key === 'ArrowLeft') delta.x -= nudgeAmount;
        if (e.key === 'ArrowRight') delta.x += nudgeAmount;
        if (e.key === 'PageUp') delta.y += nudgeAmount;
        if (e.key === 'PageDown') delta.y -= nudgeAmount;

        setBuildings(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, position: [b.position[0] + delta.x, Math.max(b.position[1] + delta.y, b.size[1]/2), b.position[2] + delta.z] } : b));
        setMasts(prev => prev.map(m => selectedIds.includes(m.id) ? { ...m, position: [m.position[0] + delta.x, Math.max(m.position[1] + delta.y, 0), m.position[2] + delta.z] } : m));
        setConductors(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, points: [[c.points[0][0] + delta.x, c.points[0][1] + delta.y, c.points[0][2] + delta.z], [c.points[1][0] + delta.x, c.points[1][1] + delta.y, c.points[1][2] + delta.z]] } : c));
        if (selectedIds.includes('ZPR_MESH')) {
           setZprOffset(prev => [prev[0] + delta.x, prev[1] + delta.y, prev[2] + delta.z]);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, masts, buildings, conductors, boxes, clipboard, history]);
  
  // NBR 5419 / IEC 62305 standards
  const spdaStandards = {
    1: { radius: 20, mesh: 5, downSp: 10 },
    2: { radius: 30, mesh: 10, downSp: 10 },
    3: { radius: 45, mesh: 15, downSp: 15 },
    4: { radius: 60, mesh: 20, downSp: 20 }
  };

  const handleAddMast = () => { setInteractionMode('add-mast'); setSelectedIds([]); };
  const handleAddBuilding = () => { setInteractionMode('add-building'); setSelectedIds([]); };
  const handleAddVolume = () => { setInteractionMode('add-volume'); setSelectedIds([]); };
  const handleAddConductor = () => { setInteractionMode('add-conductor'); setSelectedIds([]); };
  
  const handleClear = () => {
    if (systemMode === 'analyze') return;
    pushState();
    setMasts([]);
    setConductors([]);
    setBuildings([]);
    setBoxes([]);
    setInteractionMode('select');
    setSelectedIds([]);
  };

  const handleAnalyze = () => {
    setSystemMode('analyze');
  };

  const handleClearAnalysis = () => {
    setSystemMode('edit');
  };

  const selectedBuilding = selectedIds.length > 0 ? buildings.find(b => b.id === selectedId) : null;
  const selectedMast = selectedIds.length > 0 ? masts.find(m => m.id === selectedId) : null;

  const onUpdatePositions = (draggedId, newPos, type, delta) => {
    // If multiple are selected, drag them all together
    if (selectedIds.includes(draggedId) && delta) {
      pushState();
      setBuildings(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, position: [b.position[0] + delta.x, Math.max(b.position[1] + delta.y, b.size[1]/2), b.position[2] + delta.z] } : b));
      setMasts(prev => prev.map(m => selectedIds.includes(m.id) ? { ...m, position: [m.position[0] + delta.x, Math.max(m.position[1] + delta.y, 0), m.position[2] + delta.z] } : m));
      setConductors(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, points: [[c.points[0][0] + delta.x, c.points[0][1] + delta.y, c.points[0][2] + delta.z], [c.points[1][0] + delta.x, c.points[1][1] + delta.y, c.points[1][2] + delta.z]] } : c));
    } else {
      pushState();
      if (type === 'building') {
        setBuildings(prev => prev.map(b => b.id === draggedId ? { ...b, position: [newPos.x, Math.max(newPos.y, b.size[1]/2), newPos.z] } : b));
      } else if (type === 'mast') {
        setMasts(prev => prev.map(m => m.id === draggedId ? { ...m, position: [newPos.x, Math.max(newPos.y, 0), newPos.z] } : m));
      } else if (type === 'conductor') {
        setConductors(prev => prev.map(c => c.id === draggedId ? { ...c, points: [[c.points[0][0] + delta.x, c.points[0][1] + delta.y, c.points[0][2] + delta.z], [c.points[1][0] + delta.x, c.points[1][1] + delta.y, c.points[1][2] + delta.z]] } : c));
      }
    }
  };

  const manualNudge = (key) => {
     if (selectedIds.length === 0) return;
     pushState();
     const nudgeAmount = 0.5;
     const delta = { x: 0, y: 0, z: 0 };
     if (key === 'ArrowUp') delta.z -= nudgeAmount;
     if (key === 'ArrowDown') delta.z += nudgeAmount;
     if (key === 'ArrowLeft') delta.x -= nudgeAmount;
     if (key === 'ArrowRight') delta.x += nudgeAmount;
     if (key === 'PageUp') delta.y += nudgeAmount;
     if (key === 'PageDown') delta.y -= nudgeAmount;

     setBuildings(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, position: [b.position[0] + delta.x, Math.max(b.position[1] + delta.y, b.size[1]/2), b.position[2] + delta.z] } : b));
     setMasts(prev => prev.map(m => selectedIds.includes(m.id) ? { ...m, position: [m.position[0] + delta.x, Math.max(m.position[1] + delta.y, 0), m.position[2] + delta.z] } : m));
     setConductors(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, points: [[c.points[0][0] + delta.x, c.points[0][1] + delta.y, c.points[0][2] + delta.z], [c.points[1][0] + delta.x, c.points[1][1] + delta.y, c.points[1][2] + delta.z]] } : c));
     if (selectedIds.includes('ZPR_MESH')) {
        setZprOffset(prev => [prev[0] + delta.x, prev[1] + delta.y, prev[2] + delta.z]);
     }
  };

  const updateMastPosition = (id, axis, value) => {
    pushState();
    setMasts(prev => prev.map(m => {
      if (m.id === id) {
        const newPos = [...m.position];
        newPos[axis] = Number(value);
        return { ...m, position: newPos };
      }
      return m;
    }));
  };

  const updateMastHeight = (id, value) => {
    pushState();
    setMasts(prev => prev.map(m => m.id === id ? { ...m, height: Number(value) } : m));
  };

  const removeMast = (id) => {
    pushState();
    setMasts(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const updateSelectedBuilding = (axis, value) => {
    pushState();
    setBuildings(prev => prev.map(b => {
      // Apply size changes to all currently selected buildings!
      if (selectedIds.includes(b.id)) {
        const newSize = [...b.size];
        newSize[axis] = Number(value);
        const newPos = [...b.position];
        if (newPos[1] < newSize[1] / 2) newPos[1] = newSize[1] / 2;
        return { ...b, size: newSize, position: newPos };
      }
      return b;
    }));
  };

  const updateBuildingProp = (prop, value) => {
    pushState();
    setBuildings(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, [prop]: value } : b));
  };
  
  const updateBuildingProtSize = (axis, value) => {
    pushState();
    setBuildings(prev => prev.map(b => {
      if (selectedIds.includes(b.id)) {
        const newSize = [...(b.protSize || [3, 2, 3])];
        newSize[axis] = Number(value);
        return { ...b, protSize: newSize };
      }
      return b;
    }));
  };
  
  const updateBuildingProtOffset = (axis, value) => {
    pushState();
    setBuildings(prev => prev.map(b => {
      if (selectedIds.includes(b.id)) {
        const newOffset = [...(b.protOffset || [0, 0])];
        newOffset[axis] = Number(value);
        return { ...b, protOffset: newOffset };
      }
      return b;
    }));
  };

  // Auto Generation Logics
  const handleGenerateSPDA = () => {
    if (!selectedBuilding) return;
    pushState();
    const { position, size, roofType } = selectedBuilding;
    const [w, h, d] = size;
    const { mesh: maxSpace, downSp } = spdaStandards[protectionLevel];

    const yBase = position[1] + h / 2;
    const minX = position[0] - w / 2;
    const maxX = position[0] + w / 2;
    const minZ = position[2] - d / 2;
    const maxZ = position[2] + d / 2;

    const numX = Math.ceil(w / maxSpace);
    const numZ = Math.ceil(d / maxSpace);
    const stepX = w / numX;
    const stepZ = d / numZ;

    const getRoofY = (gx, gz) => {
      if (roofType === 'flat') return yBase;
      const longestIsX = w >= d;
      const L = longestIsX ? w : d;
      const W = longestIsX ? d : w;
      const roofH = h * 0.4;
      const bx = gx - position[0];
      const bz = gz - position[2];
      
      if (roofType === 'gable') {
          const relCross = longestIsX ? Math.abs(bz) : Math.abs(bx);
          return yBase + roofH * (1 - (relCross / (W / 2)));
      }
      if (roofType === 'cylinder') {
          const relCross = longestIsX ? Math.abs(bz) : Math.abs(bx);
          const r = W / 2;
          const hCyl = Math.sqrt(Math.max(0, r*r - relCross*relCross));
          return yBase + hCyl;
      }
      return yBase;
    };

    const newConductors = [];
    const newBoxes = [];
    const nodes = [];

    // --- 1. FARADAY CAGE (TETO) ---
    for (let i = 0; i <= numX; i++) {
        for (let j = 0; j <= numZ; j++) {
            const gx = minX + i * stepX;
            const gz = minZ + j * stepZ;
            nodes.push({ i, j, x: gx, y: getRoofY(gx, gz), z: gz });
        }
    }
    for(let i=0; i<=numX; i++) {
        for(let j=0; j<=numZ; j++) {
            const p1 = nodes.find(n => n.i === i && n.j === j);
            if (i < numX) {
                const p2 = nodes.find(n => n.i === i+1 && n.j === j);
                newConductors.push({ id: Date.now()+Math.random(), points: [[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]], type: 'mesh' });
            }
            if (j < numZ) {
                const p2 = nodes.find(n => n.i === i && n.j === j+1);
                newConductors.push({ id: Date.now()+Math.random(), points: [[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]], type: 'mesh' });
            }
        }
    }

    if (selectedBuilding.protrusion && selectedBuilding.protrusion !== 'none') {
        const protSize = selectedBuilding.protSize || [3, 2, 3];
        const protOffset = selectedBuilding.protOffset || [0, 0];
        const px = position[0] + protOffset[0];
        const pz = position[2] + protOffset[1];
        const pMinX = px - protSize[0]/2;
        const pMaxX = px + protSize[0]/2;
        const pMinZ = pz - protSize[2]/2;
        const pMaxZ = pz + protSize[2]/2;
        const pTopY = yBase + protSize[1];

        // Perimeter ring around top of protrusion
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMinX, pTopY, pMinZ], [pMaxX, pTopY, pMinZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMaxX, pTopY, pMinZ], [pMaxX, pTopY, pMaxZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMaxX, pTopY, pMaxZ], [pMinX, pTopY, pMaxZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMinX, pTopY, pMaxZ], [pMinX, pTopY, pMinZ]], type: 'mesh' });

        // Drop lines down to the main roof
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMinX, pTopY, pMinZ], [pMinX, getRoofY(pMinX, pMinZ), pMinZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMaxX, pTopY, pMinZ], [pMaxX, getRoofY(pMaxX, pMinZ), pMinZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMaxX, pTopY, pMaxZ], [pMaxX, getRoofY(pMaxX, pMaxZ), pMaxZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMinX, pTopY, pMaxZ], [pMinX, getRoofY(pMinX, pMaxZ), pMaxZ]], type: 'mesh' });

        // Cross lines on top of protrusion (X pattern)
        newConductors.push({ id: Date.now()+Math.random(), points: [[px, pTopY, pMinZ], [px, pTopY, pMaxZ]], type: 'mesh' });
        newConductors.push({ id: Date.now()+Math.random(), points: [[pMinX, pTopY, pz], [pMaxX, pTopY, pz]], type: 'mesh' });
    }

    // --- 2. DESCIDAS (DOWN CONDUCTORS) ---
    const bx = position[0];
    const bz = position[2];
    const wHalf = w / 2;
    const dHalf = d / 2;

    const corners = [
        [-wHalf, -dHalf],
        [wHalf, -dHalf],
        [wHalf, dHalf],
        [-wHalf, dHalf]
    ];
    
    let downPoints = [];
    for (let c=0; c<4; c++) {
        const c1 = corners[c];
        const c2 = corners[(c+1)%4];
        downPoints.push(c1);
        const edgeLen = Math.sqrt((c2[0]-c1[0])**2 + (c2[1]-c1[1])**2);
        const spans = Math.ceil(edgeLen / downSp);
        for(let i=1; i<spans; i++) {
            downPoints.push([
                c1[0] + (c2[0]-c1[0]) * (i/spans),
                c1[1] + (c2[1]-c1[1]) * (i/spans)
            ]);
        }
    }

    downPoints.forEach(pt => {
        // Offset by 5cm outwards from wall
        const ax = Math.abs(pt[0]);
        const az = Math.abs(pt[1]);
        const ox = ax >= wHalf - 0.01 ? Math.sign(pt[0]) * 0.05 : 0;
        const oz = az >= dHalf - 0.01 ? Math.sign(pt[1]) * 0.05 : 0;

        const wx = bx + pt[0] + ox;
        const wz = bz + pt[1] + oz;
        const yEaves = getRoofY(wx, wz);
        
        // Down conductor (from yEaves to y=0.2 for test joint box)
        newConductors.push({ id: Date.now()+Math.random(), points: [[wx, yEaves, wz], [wx, 0.15, wz]], type: 'down' });
        
        // Link from box to grounding ring (-0.5m depth, 1.5m outward from center = 1m from wall)
        let outX = pt[0] + (ax > wHalf - 0.1 ? Math.sign(pt[0]) * 1.5 : 0);
        let outZ = pt[1] + (az > dHalf - 0.1 ? Math.sign(pt[1]) * 1.5 : 0);
        
        newConductors.push({ id: Date.now()+Math.random(), points: [[wx, 0.15, wz], [bx + outX, -0.5, bz + outZ]], type: 'ground' });
        
        // Inspection box (Caixa de inspeção / Desconector) at y=0.15
        newBoxes.push({ position: [wx, 0.15, wz], offset: [ox, oz] });
    });

    // --- 3. ATERRAMENTO (GROUND RING) ---
    const ringCorners = [
        [bx - wHalf - 1.5, bz - dHalf - 1.5],
        [bx + wHalf + 1.5, bz - dHalf - 1.5],
        [bx + wHalf + 1.5, bz + dHalf + 1.5],
        [bx - wHalf - 1.5, bz + dHalf + 1.5]
    ];
    for (let c=0; c<4; c++) {
        const r1 = ringCorners[c];
        const r2 = ringCorners[(c+1)%4];
        newConductors.push({ id: Date.now()+Math.random(), points: [[r1[0], -0.5, r1[1]], [r2[0], -0.5, r2[1]]], type: 'ground' });
    }

    // --- 4. CONECTAR CAPTORES (MASTS) À MALHA ---
    const eps = 1.0; // tolerance for mast position above building bounding box
    const bMinX = position[0] - wHalf - eps;
    const bMaxX = position[0] + wHalf + eps;
    const bMinZ = position[2] - dHalf - eps;
    const bMaxZ = position[2] + dHalf - eps;

    masts.forEach(m => {
        const mx = m.position[0];
        const mz = m.position[2];
        const my = getRoofY(mx, mz); // Base of the mast
        
        // Skip masts that are clearly on another building
        if (mx < bMinX || mx > bMaxX || mz < bMinZ || mz > bMaxZ) return;
        
        let nearest = null;
        let minDist = Infinity;
        nodes.forEach(n => {
            const dist = Math.sqrt((n.x - mx)**2 + (n.z - mz)**2);
            if (dist < minDist) {
                minDist = dist;
                nearest = n;
            }
        });
        
        // Automatically throw an aluminum flat tape from Mast base to the nearest mesh intersection
        if (nearest && minDist > 0.1) {
            newConductors.push({
                id: Date.now() + Math.random(),
                points: [[mx, my, mz], [nearest.x, nearest.y, nearest.z]],
                type: 'mesh'
            });
        }
    });

    setConductors(prev => [...prev, ...newConductors]);
    setBoxes(prev => [...prev, ...newBoxes]);
  };
  
  // BoM calculations
  const totalMastLength = masts.reduce((sum, m) => sum + m.height, 0);
  const totalConductorLength = conductors.reduce((sum, c) => {
    const dx = c.points[1][0] - c.points[0][0];
    const dz = c.points[1][1] - c.points[0][1];
    return sum + Math.sqrt(dx*dx + dz*dz);
  }, 0);

  return (
    <div className="app-container">
      {/* 3D View Container */}
      <div className="canvas-container">
        <Canvas camera={{ position: [50, 40, 50], fov: 45 }} shadows gl={{ localClippingEnabled: true }}>
          <color attach="background" args={['#8cb1d1']} />
          <ambientLight intensity={0.5} />
          {/* Sun at 15:00 -> high altitude, slight angle. Warm white. */}
          <directionalLight position={[80, 120, 60]} intensity={2.5} color="#fffcf2" castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} shadow-bias={-0.0005} />
          
          {/* Photorealistic Sky (Fixed, does not move weirdly during panning) */}
          <Sky sunPosition={[80, 120, 60]} turbidity={0.1} rayleigh={0.2} mieCoefficient={0.005} mieDirectionalG={0.8} />
          
          {/* Aesthetic Nuvenzinhas ! */}
          <Cloud position={[-50, 90, -100]} opacity={0.6} scale={2} speed={0.2} />
          <Cloud position={[80, 70, -120]} opacity={0.5} scale={3} speed={0.1} color="#e2e8f0" />
          <Cloud position={[10, 80, -80]} opacity={0.4} scale={1.5} speed={0.3} />

          {/* HDRI strictly for rich reflections on conductors/glass, invisible as a background */}
          <Environment preset="city" />
          
          <ContactShadows position={[0, -0.045, 0]} opacity={0.7} scale={200} blur={2.0} far={20} resolution={2048} color="#0f172a" />
          
          {/* Main 3D Scene containing logical components */}
          <Scene 
            masts={masts} 
            setMasts={setMasts}
            conductors={conductors}
            setConductors={setConductors}
            buildings={buildings}
            setBuildings={setBuildings}
            boxes={boxes}
            interactionMode={interactionMode}
            setInteractionMode={setInteractionMode}
            protectionRadius={spdaStandards[protectionLevel].radius}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            systemMode={systemMode}
            pushState={pushState}
            onUpdatePositions={onUpdatePositions}
            clipX={clipX}
            clipY={clipY}
            clipZ={clipZ}
            zprOffset={zprOffset}
            setZprOffset={setZprOffset}
          />

          {/* Reference Grid & Soft Urban Ground (Asphalt/Concrete) */}
          <Grid infiniteGrid fadeDistance={150} fadeStrength={3} sectionColor="#475569" cellColor="#64748b" cellThickness={0.3} sectionThickness={0.6} position={[0, 0.01, 0]} />
          <axesHelper args={[100]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.05, 0]}>
            <planeGeometry args={[2000, 2000]} />
            <meshStandardMaterial color="#64748b" transparent opacity={0.85} depthWrite={true} roughness={1.0} />
          </mesh>
          <MapControls 
            makeDefault 
            maxPolarAngle={Math.PI / 2 - 0.05}
            enableKeys={selectedIds.length === 0}
            mouseButtons={{
              LEFT: interactionMode === 'pan' ? 2 : 0, // 2 is PAN, 0 is ROTATE
              MIDDLE: 2, // Scroll wheel pressed = PAN
              RIGHT: interactionMode === 'pan' ? 0 : 2
            }}
          />
        </Canvas>
      </div>

      {/* Floating UI Panel */}
      <aside className="floating-panel left-panel">
        <header>
          <h1>SPDA 3D</h1>
          <p>Modelo Eletrogeométrico (Esfera Rolante)</p>
        </header>

        <div className="section">
          <div className="section-title">Nível de Proteção</div>
          <div className="input-group">
            <label>Classe (NBR 5419 / IEC 62305)</label>
            <select 
              value={protectionLevel} 
              onChange={(e) => setProtectionLevel(Number(e.target.value))}
            >
              <option value={1}>Nível I (Raio 20m)</option>
              <option value={2}>Nível II (Raio 30m)</option>
              <option value={3}>Nível III (Raio 45m)</option>
              <option value={4}>Nível IV (Raio 60m)</option>
            </select>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Análise de ZPR (Esfera Rolante)</div>
          <div className="input-group">
            {systemMode === 'edit' ? (
              <button className="btn primary" onClick={handleAnalyze} style={{ backgroundColor: '#2563eb', color: 'white' }}>
                 Girar as Esferas (Analisar)
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn warning" onClick={handleClearAnalysis} style={{ backgroundColor: '#ef4444', color: 'white' }}>
                   Limpar Zonas (Voltar p/ Edição)
                </button>
                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Plano de Corte X</label>
                  <input type="range" min="-100" max="100" step="1" value={clipX} onChange={e => setClipX(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} title={`Corte X: ${clipX}m`} />
                  
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Plano de Corte Y (Altura)</label>
                  <input type="range" min="0" max="100" step="1" value={clipY} onChange={e => setClipY(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} title={`Corte Y: ${clipY}m`} />
                  
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Plano de Corte Z</label>
                  <input type="range" min="-100" max="100" step="1" value={clipZ} onChange={e => setClipZ(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} title={`Corte Z: ${clipZ}m`} />
                  
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right' }}>X:{clipX} | Y:{clipY} | Z:{clipZ}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="section">
          <div className="section-title">Ferramentas de Modelagem</div>
          <div className="input-group">
            <button 
              className={`btn ${interactionMode === 'add-building' ? 'primary' : ''}`}
              onClick={handleAddBuilding}
            >
              <Box size={18} /> Novo Edifício
            </button>
            <button 
              className={`btn ${interactionMode === 'add-volume' ? 'primary' : ''}`}
              onClick={handleAddVolume}
            >
              <Box size={18} /> Novo Volume (Sem Janelas)
            </button>
            <button 
              className={`btn ${interactionMode === 'add-mast' ? 'primary' : ''}`}
              onClick={handleAddMast}
            >
              <Shield size={18} /> Instalar Mastro (Franklin)
            </button>
            <button 
              className={`btn ${interactionMode === 'add-conductor' ? 'primary' : ''}`}
              onClick={handleAddConductor}
            >
              <Shield size={18} /> Cabo (Gaiola Faraday)
            </button>
            <button 
              className={`btn ${interactionMode === 'select' ? 'primary' : ''}`}
              onClick={() => setInteractionMode('select')}
            >
              <MousePointerSquareDashed size={18} /> Girar / Selecionar
            </button>
            <button 
              className={`btn ${interactionMode === 'pan' ? 'primary' : ''}`}
              onClick={() => setInteractionMode('pan')}
            >
              <Hand size={18} /> Mãozinha (Pan)
            </button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Lista de Captores</div>
          {masts.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Nenhum captor na cena.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {masts.map((m, index) => (
                <div 
                  key={m.id} 
                  style={{ 
                    padding: '8px', 
                    background: selectedIds.includes(m.id) ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)', 
                    border: `1px solid ${selectedIds.includes(m.id) ? '#3b82f6' : 'transparent'}`,
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => { 
                    if (e.ctrlKey || e.metaKey) setSelectedIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                    else setSelectedIds([m.id]); 
                    setInteractionMode('select'); 
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Captor #{index + 1}</span>
                    <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>h: {m.height}m</span>
                  </div>
                  {selectedIds.includes(m.id) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Pos X</label>
                          <input type="number" step="0.5" value={m.position[0].toFixed(2)} onChange={e => updateMastPosition(m.id, 0, e.target.value)} style={{ width: '100%', padding: '4px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Pos Z</label>
                          <input type="number" step="0.5" value={m.position[2].toFixed(2)} onChange={e => updateMastPosition(m.id, 2, e.target.value)} style={{ width: '100%', padding: '4px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Altura</label>
                          <input type="number" step="0.5" value={m.height} onChange={e => updateMastHeight(m.id, e.target.value)} style={{ width: '100%', padding: '4px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <button className="btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => removeMast(m.id)}>
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-title">Lista de Materiais (BoM)</div>
          <div className="input-group" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div>Mastros: {masts.length} ({totalMastLength.toFixed(1)} m)</div>
            <div>Cabos Horizontais: {conductors.length} ({totalConductorLength.toFixed(1)} m)</div>
            <div>Edifícios: {buildings.filter(b => b.buildingType !== 'volume').length} | Volumes: {buildings.filter(b => b.buildingType === 'volume').length}</div>
          </div>
          <button className="btn" onClick={handleClear} disabled={systemMode === 'analyze'} style={{ marginTop: '8px' }}>
            <Trash2 size={18} /> Limpar Cena
          </button>
        </div>

        {/* Properties Panel */}
        {selectedIds.length > 0 && selectedBuilding && (
          <div className="section">
            <div className="section-title">Propriedades ({selectedIds.length > 1 ? selectedIds.length + ' Selecionados' : '1 Edifício/Volume'})</div>
            <div className="input-group">
              <label>Largura (X)</label>
              <input type="number" step="0.5" value={selectedBuilding.size[0]} onChange={e => updateSelectedBuilding(0, e.target.value)} />
            </div>
            <div className="input-group">
              <label>Altura (Y)</label>
              <input type="number" step="0.5" value={selectedBuilding.size[1]} onChange={e => updateSelectedBuilding(1, e.target.value)} />
            </div>
            <div className="input-group">
              <label>Profundidade (Z)</label>
              <input type="number" step="0.5" value={selectedBuilding.size[2]} onChange={e => updateSelectedBuilding(2, e.target.value)} />
            </div>
            <div className="input-group">
              <label>Formato da Base</label>
              <select value={selectedBuilding.buildingShape || 'box'} onChange={e => updateBuildingProp('buildingShape', e.target.value)}>
                <option value="box">Retangular / Quadrada</option>
                <option value="cylinder">Cilíndrica (Tanques, Silos)</option>
              </select>
            </div>
            <div className="input-group">
              <label>Tipo de Telhado</label>
              <select value={selectedBuilding.roofType || 'flat'} onChange={e => updateBuildingProp('roofType', e.target.value)}>
                <option value="flat">Plano</option>
                <option value="gable">Triangular (Duas Águas)</option>
                <option value="cylinder">Arredondado (Cilíndrico)</option>
              </select>
            </div>
            <div className="input-group">
              <label>Protusão no Teto</label>
              <select value={selectedBuilding.protrusion || 'none'} onChange={e => updateBuildingProp('protrusion', e.target.value)}>
                <option value="none">Nenhuma</option>
                <option value="box">Caixa d'Água (Quadrada)</option>
                <option value="chimney">Chaminé (Cilíndrica)</option>
              </select>
            </div>
            {selectedBuilding.protrusion && selectedBuilding.protrusion !== 'none' && (
              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.75rem', marginBottom: '4px', color: '#94a3b8' }}>Dimensões da Protusão (W, H, D)</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  <input type="number" step="0.5" value={selectedBuilding.protSize?.[0] || 3} onChange={e => updateBuildingProtSize(0, e.target.value)} style={{ width: '33%' }} title="Width" />
                  <input type="number" step="0.5" value={selectedBuilding.protSize?.[1] || 2} onChange={e => updateBuildingProtSize(1, e.target.value)} style={{ width: '33%' }} title="Height" />
                  <input type="number" step="0.5" value={selectedBuilding.protSize?.[2] || 3} onChange={e => updateBuildingProtSize(2, e.target.value)} style={{ width: '33%' }} title="Depth" />
                </div>
                <div style={{ fontSize: '0.75rem', marginBottom: '4px', color: '#94a3b8' }}>Posição da Protusão (Eixo X, Eixo Z)</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input type="number" step="0.5" value={selectedBuilding.protOffset?.[0] || 0} onChange={e => updateBuildingProtOffset(0, e.target.value)} style={{ width: '50%' }} title="X Offset" />
                  <input type="number" step="0.5" value={selectedBuilding.protOffset?.[1] || 0} onChange={e => updateBuildingProtOffset(1, e.target.value)} style={{ width: '50%' }} title="Z Offset" />
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: '#60a5fa' }}>Automação SPDA (NBR 5419)</div>
              <button className="btn primary" style={{ width: '100%', marginBottom: '6px', backgroundColor: '#059669', color: 'white' }} onClick={handleGenerateSPDA}>
                <Settings2 size={16} /> Gerar SPDA Automático (Malha + Descidas + Aterramento)
              </button>
            </div>
            
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: '#60a5fa' }}>Movimentação Fina (Nudge 0.5m)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', maxWidth: '180px', margin: '0 auto' }}>
                <div />
                <button className="btn" style={{ padding: '6px', fontSize: '1.2rem', backgroundColor: '#334155', border: '1px solid #475569' }} onClick={() => manualNudge('ArrowUp')} title="Para Trás (-Z)">↑</button>
                <div />
                <button className="btn" style={{ padding: '6px', fontSize: '1.2rem', backgroundColor: '#334155', border: '1px solid #475569' }} onClick={() => manualNudge('ArrowLeft')} title="Esquerda (-X)">←</button>
                <button className="btn" style={{ padding: '6px', fontSize: '1.2rem', backgroundColor: '#334155', border: '1px solid #475569' }} onClick={() => manualNudge('ArrowDown')} title="Frente (+Z)">↓</button>
                <button className="btn" style={{ padding: '6px', fontSize: '1.2rem', backgroundColor: '#334155', border: '1px solid #475569' }} onClick={() => manualNudge('ArrowRight')} title="Direita (+X)">→</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                <button className="btn" style={{ flex: 1, backgroundColor: '#334155', border: '1px solid #475569' }} onClick={() => manualNudge('PageUp')} title="Para Cima (+Y)">+Y (Subir)</button>
                <button className="btn" style={{ flex: 1, backgroundColor: '#334155', border: '1px solid #475569' }} onClick={() => manualNudge('PageDown')} title="Para Baixo (-Y)">-Y (Descer)</button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Status Bar */}
      <div className="status-bar">
        {systemMode === 'analyze' && "Modo Analise Em Tempo Real: ZPR 0B (Protegida) acompanha suas edições matematicamente!"}
        {interactionMode === 'add-building' && "Clique no chão para depositar um Edifício (com janelas e detalhes)."}
        {interactionMode === 'add-volume' && "Clique no chão para depositar um Volume (sem janelas, apenas obstáculo)."}
        {interactionMode === 'add-mast' && "Clique em um edifício ou no chão (com Snapping magnético automático nas bordas)."}
        {interactionMode === 'add-conductor' && "Clique em um ponto para iniciar o cabo e clique em outro para finalizar."}
        {interactionMode === 'select' && "Use o Left-Click para Girar e Right-Click para Pan. Zoom foca na ponta do mouse!"}
        {interactionMode === 'pan' && "Use o Left-Click para Pan (Mãozinha) e Right-Click para Girar. Zoom foca na ponta do mouse!"}
      </div>
    </div>
  );
}

export default App;
