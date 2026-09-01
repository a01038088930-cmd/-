import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CelestialBody } from '../types';
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Layers, 
  Compass, 
  Activity, 
  Info,
  Maximize2
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface GravityLabProps {
  isRunning: boolean;
  timeScale: number;
}

const PRESETS: { name: string; description: string; getBodies: (w: number, h: number) => CelestialBody[] }[] = [
  {
    name: '태양계 모형 (Solar System)',
    description: '중심 태양 주위를 도는 수성, 지구, 화성, 목성의 안정적인 케플러 공전 궤도',
    getBodies: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      return [
        { id: 'sun', name: '태양 (Sun)', x: cx, y: cy, vx: 0, vy: 0, mass: 12000, radius: 18, color: '#fbbf24', fixed: true, trail: [] },
        { id: 'mercury', name: '수성 (Mercury)', x: cx + 70, y: cy, vx: 0, vy: -13.0, mass: 1.5, radius: 4, color: '#94a3b8', trail: [] },
        { id: 'earth', name: '지구 (Earth)', x: cx + 140, y: cy, vx: 0, vy: -9.2, mass: 10, radius: 7, color: '#38bdf8', trail: [] },
        { id: 'mars', name: '화성 (Mars)', x: cx + 210, y: cy, vx: 0, vy: -7.5, mass: 4, radius: 5.5, color: '#f87171', trail: [] },
        { id: 'jupiter', name: '목성 (Jupiter)', x: cx + 320, y: cy, vx: 0, vy: -6.1, mass: 120, radius: 12, color: '#fb923c', trail: [] },
      ];
    }
  },
  {
    name: '삼체 문제 카오스 (Three-Body Chaos)',
    description: '서로 상호작용하는 동일 질량 3개 항성의 예측 불가능한 카오스 궤적',
    getBodies: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const r = 120;
      return [
        { id: 's1', name: '항성 A', x: cx + r * Math.cos(0), y: cy + r * Math.sin(0), vx: -2.5, vy: 3.5, mass: 3000, radius: 11, color: '#f43f5e', trail: [] },
        { id: 's2', name: '항성 B', x: cx + r * Math.cos((2 * Math.PI) / 3), y: cy + r * Math.sin((2 * Math.PI) / 3), vx: 3.8, vy: -1.2, mass: 3000, radius: 11, color: '#06b6d4', trail: [] },
        { id: 's3', name: '항성 C', x: cx + r * Math.cos((4 * Math.PI) / 3), y: cy + r * Math.sin((4 * Math.PI) / 3), vx: -1.3, vy: -2.3, mass: 3000, radius: 11, color: '#eab308', trail: [] },
      ];
    }
  },
  {
    name: '무어 8자 궤도 (Figure-8 Solution)',
    description: '1993년 발견된 완벽한 대칭 주기를 갖는 기적의 3체 궤도 해',
    getBodies: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const scale = 140;
      const vx = 4.2;
      const vy = 3.9;
      return [
        { id: 'f1', name: '천체 1', x: cx - scale * 0.97000436, y: cy + scale * 0.24308753, vx: vx * 0.46620531, vy: vy * 0.43236573, mass: 3500, radius: 9, color: '#38bdf8', trail: [] },
        { id: 'f2', name: '천체 2', x: cx + scale * 0.97000436, y: cy - scale * 0.24308753, vx: vx * 0.46620531, vy: vy * 0.43236573, mass: 3500, radius: 9, color: '#ec4899', trail: [] },
        { id: 'f3', name: '천체 3', x: cx, y: cy, vx: -vx * 0.93241062, vy: -vy * 0.86473146, mass: 3500, radius: 9, color: '#10b981', trail: [] },
      ];
    }
  },
  {
    name: '중력 슬링샷 (Gravity Slingshot)',
    description: '거대 행성의 중력장을 이용해 가속도를 얻어 외우주로 탈출하는 탐사선',
    getBodies: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      return [
        { id: 'star', name: '중심 항성', x: cx - 180, y: cy, vx: 0, vy: 0, mass: 15000, radius: 18, color: '#f59e0b', fixed: true, trail: [] },
        { id: 'planet', name: '거대 가스행성', x: cx + 80, y: cy, vx: 0, vy: -7.5, mass: 900, radius: 14, color: '#0ea5e9', trail: [] },
        { id: 'probe', name: '보이저 탐사선', x: cx - 220, y: cy + 180, vx: 5.5, vy: -3.8, mass: 0.1, radius: 4, color: '#f43f5e', trail: [] },
      ];
    }
  },
  {
    name: '라그랑주 L4/L5 트로이계',
    description: '태양과 목성의 중력 및 원심력이 완벽히 평형을 이루는 L4/L5 트로이 소행성군',
    getBodies: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const R = 220;
      const M1 = 16000;
      const M2 = 800;
      const omega = Math.sqrt(0.8 * (M1 + M2) / (R * R * R));
      const v2 = omega * R;

      // L4 & L5 at +/- 60 degrees
      const l4x = cx + R * Math.cos(-Math.PI / 3);
      const l4y = cy + R * Math.sin(-Math.PI / 3);
      const l5x = cx + R * Math.cos(Math.PI / 3);
      const l5y = cy + R * Math.sin(Math.PI / 3);

      return [
        { id: 'sun', name: '주항성', x: cx, y: cy, vx: 0, vy: 0, mass: M1, radius: 18, color: '#f59e0b', fixed: true, trail: [] },
        { id: 'jupiter', name: '거대행성', x: cx + R, y: cy, vx: 0, vy: -v2, mass: M2, radius: 12, color: '#38bdf8', trail: [] },
        { id: 'trojan1', name: 'L4 트로이 소행성 A', x: l4x, y: l4y, vx: v2 * Math.sin(-Math.PI / 3), vy: -v2 * Math.cos(-Math.PI / 3), mass: 0.1, radius: 3.5, color: '#a855f7', trail: [] },
        { id: 'trojan2', name: 'L5 트로이 소행성 B', x: l5x, y: l5y, vx: v2 * Math.sin(Math.PI / 3), vy: -v2 * Math.cos(Math.PI / 3), mass: 0.1, radius: 3.5, color: '#ec4899', trail: [] },
      ];
    }
  }
];

export const GravityLab: React.FC<GravityLabProps> = ({ isRunning, timeScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation physics parameters
  const [G, setG] = useState<number>(0.8);
  const [trailLength, setTrailLength] = useState<number>(80);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showForceLines, setShowForceLines] = useState<boolean>(false);
  const [mergeOnCollision, setMergeOnCollision] = useState<boolean>(true);
  
  // Spawning state
  const [spawnMass, setSpawnMass] = useState<number>(10);
  const [spawnType, setSpawnType] = useState<'planet' | 'heavy' | 'star' | 'blackhole'>('planet');
  const [isFixedNew, setIsFixedNew] = useState<boolean>(false);

  // Interaction dragging state
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Bodies state
  const [bodies, setBodies] = useState<CelestialBody[]>([]);
  const bodiesRef = useRef<CelestialBody[]>([]);
  bodiesRef.current = bodies;

  // Telemetry stats
  const [stats, setStats] = useState({
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    bodyCount: 0,
  });

  // Load preset on mount or resize
  const loadPreset = useCallback((presetIndex: number) => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const preset = PRESETS[presetIndex];
    if (preset) {
      setBodies(preset.getBodies(w, h));
    }
  }, []);

  // Initialize canvas size
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = Math.max(520, rect.height);
        if (bodiesRef.current.length === 0) {
          loadPreset(0);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [loadPreset]);

  // Main physics & animation loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Clear Canvas with subtle deep space background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Starfield grid
      ctx.strokeStyle = '#1e293b40';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      let currentBodies = [...bodiesRef.current];

      // Physics Integration Step (Verlet / Euler-Cromer)
      if (isRunning && currentBodies.length > 0) {
        const dt = 0.5 * timeScale;
        const subSteps = 3; // Sub-stepping for orbital accuracy
        const subDt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
          // Calculate pairwise gravitational forces
          const accs = currentBodies.map(() => ({ ax: 0, ay: 0 }));

          for (let i = 0; i < currentBodies.length; i++) {
            const b1 = currentBodies[i];
            if (b1.fixed) continue;

            for (let j = 0; j < currentBodies.length; j++) {
              if (i === j) continue;
              const b2 = currentBodies[j];
              const dx = b2.x - b1.x;
              const dy = b2.y - b1.y;
              const distSq = dx * dx + dy * dy + 16; // Softening parameter to prevent infinity
              const dist = Math.sqrt(distSq);

              const force = (G * b1.mass * b2.mass) / distSq;
              const ax = (force * (dx / dist)) / b1.mass;
              const ay = (force * (dy / dist)) / b1.mass;

              accs[i].ax += ax;
              accs[i].ay += ay;
            }
          }

          // Update velocities and positions
          for (let i = 0; i < currentBodies.length; i++) {
            const b = currentBodies[i];
            if (!b.fixed) {
              b.vx += accs[i].ax * subDt;
              b.vy += accs[i].ay * subDt;
              b.x += b.vx * subDt;
              b.y += b.vy * subDt;
            }
          }

          // Handle Collisions / Merging
          if (mergeOnCollision) {
            const toRemove = new Set<number>();
            for (let i = 0; i < currentBodies.length; i++) {
              if (toRemove.has(i)) continue;
              const b1 = currentBodies[i];

              for (let j = i + 1; j < currentBodies.length; j++) {
                if (toRemove.has(j)) continue;
                const b2 = currentBodies[j];
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < b1.radius + b2.radius) {
                  // Merge: larger body absorbs smaller body with momentum conservation
                  const bigger = b1.mass >= b2.mass ? b1 : b2;
                  const smaller = b1.mass >= b2.mass ? b2 : b1;
                  const idxToRemove = b1.mass >= b2.mass ? j : i;

                  const totalMass = bigger.mass + smaller.mass;
                  if (!bigger.fixed) {
                    bigger.vx = (bigger.vx * bigger.mass + smaller.vx * smaller.mass) / totalMass;
                    bigger.vy = (bigger.vy * bigger.mass + smaller.vy * smaller.mass) / totalMass;
                  }
                  bigger.mass = totalMass;
                  bigger.radius = Math.min(35, Math.pow(Math.pow(bigger.radius, 3) + Math.pow(smaller.radius, 3), 1 / 3));

                  toRemove.add(idxToRemove);
                  playBlip(280, 0.08);
                }
              }
            }

            if (toRemove.size > 0) {
              currentBodies = currentBodies.filter((_, idx) => !toRemove.has(idx));
            }
          }
        }

        // Record trails
        for (const b of currentBodies) {
          if (trailLength > 0) {
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > trailLength) {
              b.trail.shift();
            }
          } else {
            b.trail = [];
          }
        }

        bodiesRef.current = currentBodies;
      }

      // Energy Telemetry Calculation
      let totalKe = 0;
      let totalPe = 0;
      for (let i = 0; i < currentBodies.length; i++) {
        const b1 = currentBodies[i];
        totalKe += 0.5 * b1.mass * (b1.vx * b1.vx + b1.vy * b1.vy);

        for (let j = i + 1; j < currentBodies.length; j++) {
          const b2 = currentBodies[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.max(10, Math.sqrt(dx * dx + dy * dy));
          totalPe -= (G * b1.mass * b2.mass) / dist;
        }
      }

      setStats({
        kineticEnergy: Math.round(totalKe),
        potentialEnergy: Math.round(totalPe),
        totalEnergy: Math.round(totalKe + totalPe),
        bodyCount: currentBodies.length,
      });

      // Render Gravitational Force Lines
      if (showForceLines) {
        ctx.lineWidth = 1;
        for (let i = 0; i < currentBodies.length; i++) {
          for (let j = i + 1; j < currentBodies.length; j++) {
            const b1 = currentBodies[i];
            const b2 = currentBodies[j];
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const alpha = Math.min(0.6, 200 / (dist + 50));

            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(b1.x, b1.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.stroke();
          }
        }
      }

      // Render Orbit Trails
      for (const b of currentBodies) {
        if (b.trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = b.color;
          ctx.lineWidth = Math.max(1.2, b.radius * 0.25);
          for (let i = 0; i < b.trail.length; i++) {
            const pt = b.trail[i];
            const alpha = (i / b.trail.length) * 0.7;
            ctx.strokeStyle = b.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            if (i === 0) {
              ctx.moveTo(pt.x, pt.y);
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
          ctx.stroke();
        }
      }

      // Render Celestial Bodies
      for (const b of currentBodies) {
        // Glowing halo for large mass / stars
        if (b.mass > 500) {
          const grad = ctx.createRadialGradient(b.x, b.y, b.radius * 0.5, b.x, b.y, b.radius * 3.2);
          grad.addColorStop(0, b.color + '80');
          grad.addColorStop(1, b.color + '00');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Body sphere
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.mass > 200 ? 14 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border ring
        ctx.strokeStyle = '#ffffff80';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Velocity vector arrow
        if (showVectors && !b.fixed && (b.vx !== 0 || b.vy !== 0)) {
          const vScale = 6;
          const endX = b.x + b.vx * vScale;
          const endY = b.y + b.vy * vScale;

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(b.vy, b.vx);
          const headLen = 6;
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
          ctx.fill();
        }

        // Body name label
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x, b.y + b.radius + 12);
      }

      // Render Drag Creation Vector
      if (dragStart && dragCurrent) {
        const dx = dragCurrent.x - dragStart.x;
        const dy = dragCurrent.y - dragStart.y;
        const radius = getRadiusForType(spawnType, spawnMass);
        const color = getColorForType(spawnType);

        // Preview body
        ctx.beginPath();
        ctx.arc(dragStart.x, dragStart.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color + '90';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Aiming vector (drag opposite to launch direction or direct direction)
        const launchVx = (dragStart.x - dragCurrent.x) * 0.1;
        const launchVy = (dragStart.y - dragCurrent.y) * 0.1;

        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(dragStart.x + launchVx * 8, dragStart.y + launchVy * 8);
        ctx.stroke();
        ctx.setLineDash([]);

        // Speed text
        const speed = Math.sqrt(launchVx * launchVx + launchVy * launchVy).toFixed(1);
        ctx.fillStyle = '#f43f5e';
        ctx.font = '11px monospace';
        ctx.fillText(`속도: ${speed}`, dragStart.x, dragStart.y - radius - 8);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, timeScale, G, trailLength, showVectors, showForceLines, mergeOnCollision, dragStart, dragCurrent, spawnType, spawnMass]);

  // Helper radius & colors
  const getRadiusForType = (type: string, mass: number): number => {
    switch (type) {
      case 'star': return 16;
      case 'heavy': return 11;
      case 'blackhole': return 8;
      case 'planet':
      default: return Math.max(4, Math.min(10, Math.sqrt(mass) * 1.8));
    }
  };

  const getColorForType = (type: string): string => {
    switch (type) {
      case 'star': return '#f59e0b';
      case 'heavy': return '#fb923c';
      case 'blackhole': return '#c084fc';
      case 'planet':
      default: return '#38bdf8';
    }
  };

  // Mouse Interaction handlers for spawning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setDragCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDragCurrent({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseUp = () => {
    if (!dragStart || !dragCurrent) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const vx = (dragStart.x - dragCurrent.x) * 0.1;
    const vy = (dragStart.y - dragCurrent.y) * 0.1;

    let mass = spawnMass;
    if (spawnType === 'star') mass = 8000;
    if (spawnType === 'heavy') mass = 250;
    if (spawnType === 'blackhole') mass = 25000;

    const newBody: CelestialBody = {
      id: `body-${Date.now()}`,
      name: `${spawnType === 'star' ? '항성' : spawnType === 'heavy' ? '가스행성' : spawnType === 'blackhole' ? '블랙홀' : '행성'} ${bodies.length + 1}`,
      x: dragStart.x,
      y: dragStart.y,
      vx: isFixedNew ? 0 : vx,
      vy: isFixedNew ? 0 : vy,
      mass,
      radius: getRadiusForType(spawnType, mass),
      color: getColorForType(spawnType),
      fixed: isFixedNew,
      trail: []
    };

    setBodies(prev => [...prev, newBody]);
    playBlip(600, 0.08);

    setDragStart(null);
    setDragCurrent(null);
  };

  const clearBodies = () => {
    setBodies([]);
    playBlip(300, 0.05);
  };

  const clearTrails = () => {
    setBodies(prev => prev.map(b => ({ ...b, trail: [] })));
    playBlip(450, 0.04);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Simulation Interactive Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-[#000000] rounded-sm border border-[#222] shadow-2xl overflow-hidden min-h-[500px] flex flex-col"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Canvas Floating Top Overlay: Telemetry */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none z-10">
          <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-sm border border-[#333] text-xs shadow-lg flex items-center gap-3 font-mono">
            <div className="flex items-center gap-1.5 text-[#00D1FF]">
              <Compass className="w-3.5 h-3.5" />
              <span>BODIES: <strong className="text-white">{stats.bodyCount}</strong></span>
            </div>
            <div className="w-px h-3 bg-[#333]" />
            <div className="text-emerald-400">
              Ek: <strong className="text-white">{stats.kineticEnergy}</strong>
            </div>
            <div className="w-px h-3 bg-[#333]" />
            <div className="text-amber-400">
              Ep: <strong className="text-white">{stats.potentialEnergy}</strong>
            </div>
            <div className="w-px h-3 bg-[#333]" />
            <div className="text-[#00D1FF]">
              E_tot: <strong className="text-white">{stats.totalEnergy}</strong>
            </div>
          </div>
        </div>

        {/* Canvas Floating Bottom Tip */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none text-neutral-400 text-xs z-10 font-mono">
          <div className="bg-black/85 backdrop-blur-sm px-3 py-1 rounded-sm border border-[#333]">
            [CLICK & DRAG] 천체를 드래그하여 초기 속도 벡터 부여 및 발사
          </div>
          <button
            onClick={clearTrails}
            className="pointer-events-auto bg-[#1A1A1A] hover:bg-[#252525] px-2.5 py-1 rounded-sm border border-[#333] text-neutral-300 hover:text-white transition-colors"
          >
            궤적 지우기
          </button>
        </div>
      </div>

      {/* Side Control & Parameter Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-3.5 bg-[#080808] p-4 rounded-sm border border-[#222] text-sm overflow-y-auto font-sans">
        {/* Preset Selector */}
        <div>
          <label className="text-[11px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2 font-mono">
            <span className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full shadow-[0_0_6px_#00D1FF]"></span>
            천체 궤도 프리셋
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map((preset, idx) => (
              <button
                key={preset.name}
                onClick={() => {
                  playBlip(540, 0.05);
                  loadPreset(idx);
                }}
                className="text-left px-2.5 py-2 rounded-sm bg-[#121212] hover:bg-[#1A1A1A] border border-[#222] hover:border-[#00D1FF]/50 transition-all text-xs group"
              >
                <div className="font-semibold text-neutral-200 group-hover:text-[#00D1FF]">{preset.name}</div>
                <div className="text-[10px] font-mono text-neutral-500 line-clamp-1 mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[#1F1F1F]" />

        {/* Physics Sliders */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-white uppercase tracking-widest flex items-center gap-2 font-mono">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
            물리 파라미터 조절
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-neutral-300 mb-1">
              <span>GRAVITY CONST (G)</span>
              <span className="text-[#00D1FF]">{G.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={G}
              onChange={(e) => setG(parseFloat(e.target.value))}
              aria-label="중력 상수 G"
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-neutral-300 mb-1">
              <span>TRAIL LENGTH</span>
              <span className="text-[#00D1FF]">{trailLength} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="10"
              value={trailLength}
              onChange={(e) => setTrailLength(parseInt(e.target.value))}
              aria-label="궤적 길이"
              className="w-full"
            />
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            <button
              onClick={() => setShowVectors(!showVectors)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold border transition-colors ${
                showVectors ? 'bg-[#00D1FF] text-black border-[#00D1FF]' : 'bg-[#141414] border-[#333] text-neutral-400 hover:text-white'
              }`}
            >
              {showVectors ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>속도 벡터</span>
            </button>

            <button
              onClick={() => setShowForceLines(!showForceLines)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold border transition-colors ${
                showForceLines ? 'bg-[#00D1FF] text-black border-[#00D1FF]' : 'bg-[#141414] border-[#333] text-neutral-400 hover:text-white'
              }`}
            >
              <span>인력선</span>
            </button>

            <button
              onClick={() => setMergeOnCollision(!mergeOnCollision)}
              className={`col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-mono border transition-colors ${
                mergeOnCollision ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-[#141414] border-[#333] text-neutral-400'
              }`}
            >
              <span>충돌 질량 병합: {mergeOnCollision ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div className="h-px bg-[#1F1F1F]" />

        {/* Spawner Config */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-white uppercase tracking-widest flex items-center gap-2 font-mono">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            천체 생성 설정
          </div>

          <div className="grid grid-cols-2 gap-1.5 font-mono">
            {(['planet', 'heavy', 'star', 'blackhole'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSpawnType(type)}
                className={`py-1.5 px-2 rounded-sm text-xs border transition-all ${
                  spawnType === type
                    ? 'bg-[#00D1FF] border-[#00D1FF] text-black font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]'
                    : 'bg-[#141414] border-[#333] text-neutral-300 hover:bg-[#1E1E1E]'
                }`}
              >
                {type === 'planet' && '🪐 암석 행성'}
                {type === 'heavy' && '🌕 거대 행성'}
                {type === 'star' && '☀️ 거대 항성'}
                {type === 'blackhole' && '🕳️ 블랙홀'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isFixedNew}
              onChange={(e) => setIsFixedNew(e.target.checked)}
              className="rounded-sm accent-[#00D1FF]"
            />
            <span>고정 좌표 (움직이지 않는 중심)</span>
          </label>
        </div>

        <div className="mt-auto pt-2 flex gap-2">
          <button
            onClick={clearBodies}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-sm bg-[#1A1A1A] hover:bg-rose-950/40 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>모든 천체 비우기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
