import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, Environment, Sky, ContactShadows } from '@react-three/drei';
import { Shield, Box, Plus, Settings2, Trash2, MousePointerSquareDashed, Hand, Video, Film, Map, Zap, Wind, Grid3X3, Activity, Compass, FileText, User, Trees, Car, Lightbulb, Ruler, ShoppingCart, Info, Download, Trash } from 'lucide-react';
import Scene from './components/Scene';

const spdaStandards = {
  1: { radius: 20, mesh: 5 },
  2: { radius: 30, mesh: 10 },
  3: { radius: 45, mesh: 15 },
  4: { radius: 60, mesh: 20 }
};

function App() {
  const [masts, setMasts] = useState([]);
  const [conductors, setConductors] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [interactionMode, setInteractionMode] = useState('select');
  const [protectionLevel, setProtectionLevel] = useState(4);
  const [systemMode, setSystemMode] = useState('analyze');
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [isCinemaActive, setIsCinemaActive] = useState(false);
  const [zprOpacity, setZprOpacity] = useState(0.4);
  const [rulerPoints, setRulerPoints] = useState([]);
  const [hoveredPos, setHoveredPos] = useState(null);
  
  // Section Cuts (X, Y, Z sliders as seen in screenshot)
  const [clipX, setClipX] = useState(120);
  const [clipY, setClipY] = useState(120);
  const [clipZ, setClipZ] = useState(120);

  // Urbanism
  const [roads, setRoads] = useState([]);
  const [trees, setTrees] = useState([]);
  const [poles, setPoles] = useState([]);
  const [cars, setCars] = useState([]);
  const [people, setPeople] = useState([]);

  const clipRef = useRef({ x: 120, y: 120, z: 120 });
  const protectionRadius = useMemo(() => spdaStandards[protectionLevel]?.radius || 60, [protectionLevel]);

  useEffect(() => {
    clipRef.current = { x: clipX, y: clipY, z: clipZ };
  }, [clipX, clipY, clipZ]);

  const pushState = () => {
    setHistory(prev => [...prev, JSON.stringify({ masts, buildings, conductors, roads, trees, poles, cars, people })].slice(-30));
  };

  const handleUrbanize = () => {
    pushState();
    const midX = buildings.length > 0 ? buildings[0].position[0] : 0;
    const midZ = buildings.length > 0 ? buildings[0].position[2] : 0;
    const streetZ = midZ + 30;
    
    setRoads([{ id: 'r1', points: [[midX - 250, 0, streetZ], [midX + 250, 0, streetZ]], roadWidth: 12, sidewalkWidth: 5 }]);
    
    const newPoles = []; const newTrees = []; const newCars = [];
    for (let x = midX - 200; x <= midX + 200; x += 40) {
       newPoles.push({ id: `p-${x}`, position: [x, 0, streetZ - 8.5] });
       newTrees.push({ id: `t-${x}`, position: [x + 20, 0, streetZ + 8.5], scale: 1.3 });
       newCars.push({ id: `c-${x}`, position: [x + 10, 0.1, streetZ + 3], rotation: Math.PI/2, type: Math.random() > 0.8 ? 'bus' : 'car' });
    }
    setPoles(newPoles); setTrees(newTrees); setCars(newCars);
  };

  const onUpdatePositions = (id, newPos, type, delta) => {
    if (selectedIds.includes(id) && delta) {
      if (type === 'building') setBuildings(prev => prev.map(b => selectedIds.includes(b.id) ? { ...b, position: [b.position[0] + delta.x, b.position[1], b.position[2] + delta.z] } : b));
      if (type === 'mast') setMasts(prev => prev.map(m => selectedIds.includes(m.id) ? { ...m, position: [m.position[0] + delta.x, m.position[1] + delta.y, m.position[2] + delta.z] } : m));
    } else {
      if (type === 'building') setBuildings(prev => prev.map(b => b.id === id ? { ...b, position: [newPos.x, newPos.y, newPos.z] } : b));
      if (type === 'mast') setMasts(prev => prev.map(m => m.id === id ? { ...m, position: [newPos.x, newPos.y, newPos.z] } : m));
    }
  };

  return (
    <div className="app-container">
      <div className="canvas-container">
        <Canvas camera={{ position: [90, 80, 90], fov: 38 }} shadows gl={{ localClippingEnabled: true }}>
          <color attach="background" args={['#2c3e2f']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[100, 150, 100]} intensity={3.5} castShadow shadow-mapSize={[2048, 2048]} />
          <Sky sunPosition={[100, 150, 100]} turbidity={0.02} rayleigh={0.1} />
          <Environment preset="city" />
          <Scene 
             masts={masts} setMasts={setMasts} buildings={buildings} setBuildings={setBuildings} conductors={conductors} setConductors={setConductors}
             roads={roads} trees={trees} poles={poles} cars={cars} people={people} interactionMode={interactionMode} setInteractionMode={setInteractionMode}
             systemMode={systemMode} protectionRadius={protectionRadius} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
             onUpdatePositions={onUpdatePositions} pushState={pushState} clipRef={clipRef} zprOpacity={zprOpacity}
             hoveredPos={hoveredPos} setHoveredPos={setHoveredPos} rulerPoints={rulerPoints} setRulerPoints={setRulerPoints}
             dimensions={dimensions} setDimensions={setDimensions}
          />
          <MapControls makeDefault />
        </Canvas>
      </div>

      <aside className="premium-sidebar">
        <div className="sidebar-header">
           <Zap size={28} color="#3b82f6" fill="#3b82f6" />
           <span className="sidebar-brand">SPDA PREMIUM SUITE</span>
        </div>
        <div className="sidebar-nav">
           <SideBtn icon={<Box/>} label="NOVO EDIFÍCIO" active={interactionMode === 'add-building'} onClick={() => setInteractionMode('add-building')} />
           <SideBtn icon={<Shield/>} label="NOVO VOLUME" active={interactionMode === 'add-volume'} onClick={() => setInteractionMode('add-volume')} />
           <SideBtn icon={<Wind/>} label="CAPTAÇÃO" active={interactionMode === 'add-mast'} onClick={() => setInteractionMode('add-mast')} />
           <SideBtn icon={<Zap/>} label="CONDUTOR" active={interactionMode === 'add-conductor'} onClick={() => setInteractionMode('add-conductor')} />
           
           <div className="level-selector-sidebar" style={{marginTop:20}}>
              <span className="sidebar-label">NÍVEL SPDA (RAIO)</span>
              <div className="level-grid">
                {[1,2,3,4].map(l => (
                  <button key={l} className={`level-btn ${protectionLevel === l ? 'active' : ''}`} onClick={() => setProtectionLevel(l)}>
                    {['I','II','III','IV'][l-1]} ({spdaStandards[l].radius}m)
                  </button>
                ))}
              </div>
           </div>

           <SideBtn icon={<Map/>} label="GERAR URBANISMO" onClick={handleUrbanize} />
           <SideBtn icon={<Ruler/>} label="MEDIÇÃO RÉGUA" active={interactionMode === 'ruler'} onClick={() => setInteractionMode('ruler')} />
           <SideBtn icon={<FileText/>} label="EXPORTAR RELATÓRIO" onClick={() => {}} />
           
           <div style={{marginTop:'auto', width:'100%', padding:12}}>
              <button className="delete-btn" style={{background:'rgba(239, 68, 68, 0.1)', color:'#ef4444'}} onClick={() => { setMasts([]); setBuildings([]); setRoads([]); setPoles([]); }}>LIMPAR CENA</button>
           </div>
        </div>
      </aside>

      {/* Persistent Section Cut Sliders (As seen in the screenshot right-side) */}
      <div className="inspector-popup" style={{top: 460, width: 280, padding: 16}}>
          <div className="inspector-header"><span>CORTES DE SEÇÃO (X, Y, Z)</span></div>
          <div className="inspector-body">
             <div className="field-row"><label>CORTE X</label><input type="range" min="-100" max="100" value={clipX} onChange={e => setClipX(Number(e.target.value))} /><span>{clipX}</span></div>
             <div className="field-row"><label>CORTE Y</label><input type="range" min="0" max="100" value={clipY} onChange={e => setClipY(Number(e.target.value))} /><span>{clipY}</span></div>
             <div className="field-row"><label>CORTE Z</label><input type="range" min="-100" max="100" value={clipZ} onChange={e => setClipZ(Number(e.target.value))} /><span>{clipZ}</span></div>
             <button className="action-btn" style={{marginTop:8, width:'100%'}} onClick={() => { setClipX(100); setClipY(100); setClipZ(100); }}>RESETAR CORTES</button>
          </div>
      </div>

      {/* Bottom Control Bar (As seen in the screenshot bottom) */}
      <div className="control-overlay">
         <div className="mode-toggle" style={{width: 380, borderRadius: 999}}>
            <button className={`toggle-btn ${systemMode === 'analyze' ? 'active' : ''}`} onClick={() => setSystemMode('analyze')}>ANÁLISE TÉCNICA</button>
            <button className={`toggle-btn ${systemMode === 'edit' ? 'active' : ''}`} onClick={() => setSystemMode('edit')}>DESIGN 3D</button>
         </div>
         <div className="transparency-bar" style={{marginTop:16, width: 400}}>
            <span>ZPR OPACITY</span>
            <input type="range" min="0" max="0.7" step="0.01" value={zprOpacity} onChange={e => setZprOpacity(Number(e.target.value))} />
            <button className={`orbit-btn ${isCinemaActive ? 'active' : ''}`} onClick={() => setIsCinemaActive(!isCinemaActive)}>360 ORBIT</button>
         </div>
      </div>

      {selectedIds.length > 0 && (
         <div className="inspector-popup">
            <div className="inspector-header"><span>PROPRIEDADES DO OBJETO</span><button onClick={() => setSelectedIds([])}>×</button></div>
            <div className="inspector-body">
               <button className="delete-btn" style={{width:'100%'}} onClick={handleDeleteSelected}>REMOVER ELEMENTO</button>
            </div>
         </div>
      )}
    </div>
  );
}

function SideBtn({ icon, label, active, onClick }) {
  return (
    <button className={`side-btn ${active ? 'active' : ''}`} onClick={onClick}>
       {icon} <span>{label}</span>
    </button>
  );
}

export default App;
