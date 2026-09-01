import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Sliders, 
  Layers, 
  Sparkles, 
  RotateCcw, 
  Eye, 
  Palette, 
  Maximize2,
  PenTool,
  Eraser
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface WaveLabProps {
  isRunning: boolean;
  timeScale: number;
}

type WavePreset = 'double-slit' | 'single-slit' | 'two-sources' | 'grating' | 'reflection';

const PRESET_INFOS: { id: WavePreset; name: string; desc: string }[] = [
  { id: 'double-slit', name: '영의 이중 슬릿 (Double Slit)', desc: '빛과 파동의 보강·상쇄 간섭 줄무늬와 경로차 ΔL = d sin θ' },
  { id: 'single-slit', name: '단일 슬릿 회절 (Single Slit)', desc: '슬릿 폭 w에 의한 호이겐스 파동 회절 및 중심 피크 폭' },
  { id: 'two-sources', name: '두 점파원 간섭 (Two Point Sources)', desc: '위상차 및 파원 간격에 따른 쌍곡선 간섭 마디선' },
  { id: 'grating', name: '다중 회절 격자 (Grating)', desc: '여러 개의 슬릿에 의한 극도로 선명한 스펙트럼 피크' },
  { id: 'reflection', name: '원형 장벽과 반사 (Barrier Reflection)', desc: '파동의 반사, 굴절, 모서리 회절 현상' },
];

export const WaveLab: React.FC<WaveLabProps> = ({ isRunning, timeScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation Grid Specs
  const GRID_W = 180;
  const GRID_H = 120;

  // State buffers (2D arrays flattened into Float32Array)
  const uCurr = useRef<Float32Array>(new Float32Array(GRID_W * GRID_H));
  const uPrev = useRef<Float32Array>(new Float32Array(GRID_W * GRID_H));
  const uNext = useRef<Float32Array>(new Float32Array(GRID_W * GRID_H));
  const barriers = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H));
  const intensityBuffer = useRef<Float32Array>(new Float32Array(GRID_H));

  // Controls
  const [activePreset, setActivePreset] = useState<WavePreset>('double-slit');
  const [frequency, setFrequency] = useState<number>(1.2);
  const [wavelength, setWavelength] = useState<number>(6.0);
  const [slitDistance, setSlitDistance] = useState<number>(20);
  const [slitWidth, setSlitWidth] = useState<number>(4);
  const [damping, setDamping] = useState<number>(0.003);
  const [colorScheme, setColorScheme] = useState<'cyan' | 'emerald' | 'thermal' | 'purple'>('cyan');
  const [drawMode, setDrawMode] = useState<'ripple' | 'wall' | 'eraser'>('ripple');

  const simTime = useRef<number>(0);

  // Set up barriers for presets
  const setupPreset = useCallback((preset: WavePreset, d: number, w: number) => {
    const b = barriers.current;
    b.fill(0);

    const barrierX = Math.floor(GRID_W * 0.38);
    const midY = Math.floor(GRID_H / 2);

    if (preset === 'double-slit') {
      // Solid wall at barrierX except for 2 slits
      const slit1Y = midY - Math.floor(d / 2);
      const slit2Y = midY + Math.floor(d / 2);

      for (let y = 0; y < GRID_H; y++) {
        const inSlit1 = y >= slit1Y - Math.floor(w / 2) && y <= slit1Y + Math.floor(w / 2);
        const inSlit2 = y >= slit2Y - Math.floor(w / 2) && y <= slit2Y + Math.floor(w / 2);

        if (!inSlit1 && !inSlit2) {
          b[y * GRID_W + barrierX] = 1;
          b[y * GRID_W + barrierX + 1] = 1;
        }
      }
    } else if (preset === 'single-slit') {
      // Single slit at midY
      for (let y = 0; y < GRID_H; y++) {
        const inSlit = y >= midY - Math.floor(w / 2) && y <= midY + Math.floor(w / 2);
        if (!inSlit) {
          b[y * GRID_W + barrierX] = 1;
          b[y * GRID_W + barrierX + 1] = 1;
        }
      }
    } else if (preset === 'grating') {
      // 4 slits
      const spacing = 14;
      const numSlits = 4;
      const startY = midY - Math.floor((numSlits - 1) * spacing / 2);
      const slitCenters = Array.from({ length: numSlits }, (_, i) => startY + i * spacing);

      for (let y = 0; y < GRID_H; y++) {
        let insideAny = false;
        for (const sc of slitCenters) {
          if (Math.abs(y - sc) <= Math.floor(w / 2)) {
            insideAny = true;
            break;
          }
        }
        if (!insideAny) {
          b[y * GRID_W + barrierX] = 1;
          b[y * GRID_W + barrierX + 1] = 1;
        }
      }
    } else if (preset === 'reflection') {
      // A parabolic/circular barrier reflector
      const cx = Math.floor(GRID_W * 0.7);
      const cy = midY;
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
          if (Math.abs(dist - 30) < 2 && x >= cx - 10) {
            b[y * GRID_W + x] = 1;
          }
        }
      }
    }

    // Reset fields
    uCurr.current.fill(0);
    uPrev.current.fill(0);
    uNext.current.fill(0);
    intensityBuffer.current.fill(0);
    simTime.current = 0;
  }, []);

  // Update preset when parameters change
  useEffect(() => {
    setupPreset(activePreset, slitDistance, slitWidth);
  }, [activePreset, slitDistance, slitWidth, setupPreset]);

  // Main Wave equation simulation loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const graphCanvas = graphCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Simulation Step (FDTD 2D Wave equation)
      if (isRunning) {
        const stepsPerFrame = Math.max(1, Math.floor(2 * timeScale));
        const c2 = 0.35; // Wave speed squared (Courant stability condition: c2 <= 0.5)
        const dampFactor = 1.0 - damping;

        for (let s = 0; s < stepsPerFrame; s++) {
          simTime.current += 0.08 * frequency;
          const t = simTime.current;

          const curr = uCurr.current;
          const prev = uPrev.current;
          const next = uNext.current;
          const b = barriers.current;

          // Wave source injection
          if (activePreset === 'double-slit' || activePreset === 'single-slit' || activePreset === 'grating' || activePreset === 'reflection') {
            // Plane wave generator on the left column (x = 4)
            const sourceVal = Math.sin(t * 2.0);
            for (let y = 10; y < GRID_H - 10; y++) {
              curr[y * GRID_W + 4] = sourceVal * 1.5;
            }
          } else if (activePreset === 'two-sources') {
            // Two point source emitters
            const midY = Math.floor(GRID_H / 2);
            const y1 = midY - Math.floor(slitDistance / 2);
            const y2 = midY + Math.floor(slitDistance / 2);
            const x = Math.floor(GRID_W * 0.25);
            curr[y1 * GRID_W + x] = Math.sin(t * 2.0) * 1.8;
            curr[y2 * GRID_W + x] = Math.sin(t * 2.0) * 1.8;
          }

          // FDTD Finite Difference Update
          for (let y = 1; y < GRID_H - 1; y++) {
            const rowOffset = y * GRID_W;
            for (let x = 1; x < GRID_W - 1; x++) {
              const idx = rowOffset + x;
              if (b[idx] === 1) {
                next[idx] = 0;
                continue;
              }

              const laplacian = curr[idx - 1] + curr[idx + 1] + curr[idx - GRID_W] + curr[idx + GRID_W] - 4 * curr[idx];
              next[idx] = (2 * curr[idx] - prev[idx] + c2 * laplacian) * dampFactor;
            }
          }

          // Cycle buffers
          uPrev.current.set(curr);
          uCurr.current.set(next);
        }

        // 2. Accumulate detector screen intensity on the right edge (x = GRID_W - 10)
        const screenX = GRID_W - 10;
        const curr = uCurr.current;
        const intBuf = intensityBuffer.current;
        for (let y = 0; y < GRID_H; y++) {
          const val = curr[y * GRID_W + screenX];
          // Exponential moving average of amplitude squared
          intBuf[y] = intBuf[y] * 0.95 + (val * val) * 0.05;
        }
      }

      // 3. Render 2D Wave Grid to Canvas
      const imgData = ctx.createImageData(GRID_W, GRID_H);
      const data = imgData.data;
      const curr = uCurr.current;
      const b = barriers.current;

      for (let i = 0; i < GRID_W * GRID_H; i++) {
        const pIdx = i * 4;
        if (b[i] === 1) {
          // Obstacle Wall / Slit Barrier
          data[pIdx] = 148;     // R
          data[pIdx + 1] = 163; // G
          data[pIdx + 2] = 184; // B
          data[pIdx + 3] = 255; // Alpha
          continue;
        }

        const val = curr[i];
        const norm = Math.max(-1, Math.min(1, val));

        if (colorScheme === 'cyan') {
          if (norm > 0) {
            // Crest (Bright Cyan / White)
            data[pIdx] = Math.floor(30 + norm * 200);
            data[pIdx + 1] = Math.floor(180 + norm * 75);
            data[pIdx + 2] = 255;
          } else {
            // Trough (Deep Navy)
            const absN = Math.abs(norm);
            data[pIdx] = Math.floor(10 + absN * 30);
            data[pIdx + 1] = Math.floor(20 + absN * 60);
            data[pIdx + 2] = Math.floor(60 + absN * 140);
          }
          data[pIdx + 3] = 255;
        } else if (colorScheme === 'emerald') {
          if (norm > 0) {
            data[pIdx] = Math.floor(20 + norm * 180);
            data[pIdx + 1] = Math.floor(180 + norm * 75);
            data[pIdx + 2] = Math.floor(100 + norm * 155);
          } else {
            const absN = Math.abs(norm);
            data[pIdx] = 10;
            data[pIdx + 1] = Math.floor(30 + absN * 90);
            data[pIdx + 2] = Math.floor(20 + absN * 60);
          }
          data[pIdx + 3] = 255;
        } else if (colorScheme === 'thermal') {
          const norm01 = (norm + 1) * 0.5;
          data[pIdx] = Math.floor(norm01 * 255);
          data[pIdx + 1] = Math.floor(Math.sin(norm01 * Math.PI) * 220);
          data[pIdx + 2] = Math.floor((1 - norm01) * 220);
          data[pIdx + 3] = 255;
        } else {
          // Purple
          if (norm > 0) {
            data[pIdx] = Math.floor(160 + norm * 95);
            data[pIdx + 1] = Math.floor(60 + norm * 150);
            data[pIdx + 2] = 255;
          } else {
            const absN = Math.abs(norm);
            data[pIdx] = Math.floor(40 + absN * 80);
            data[pIdx + 1] = 10;
            data[pIdx + 2] = Math.floor(60 + absN * 120);
          }
          data[pIdx + 3] = 255;
        }
      }

      // Draw high-resolution scaled canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = GRID_W;
      offscreen.height = GRID_H;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, 0, 0, w, h);
      }

      // Detector line overlay on the right
      const screenPixelX = (w * (GRID_W - 10)) / GRID_W;
      ctx.strokeStyle = '#f43f5e80';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(screenPixelX, 0);
      ctx.lineTo(screenPixelX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f43f5e';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('검출기 스크린', screenPixelX - 55, 18);

      // 4. Render Detector Intensity Graph
      if (graphCanvas) {
        const gCtx = graphCanvas.getContext('2d');
        if (gCtx) {
          const gw = graphCanvas.width;
          const gh = graphCanvas.height;
          gCtx.fillStyle = '#090d16';
          gCtx.fillRect(0, 0, gw, gh);

          // Grid lines
          gCtx.strokeStyle = '#1e293b';
          gCtx.lineWidth = 1;
          for (let x = 0; x < gw; x += 30) {
            gCtx.beginPath();
            gCtx.moveTo(x, 0);
            gCtx.lineTo(x, gh);
            gCtx.stroke();
          }

          // Draw Intensity Profile
          const intBuf = intensityBuffer.current;
          let maxInt = 0.001;
          for (let y = 0; y < GRID_H; y++) {
            if (intBuf[y] > maxInt) maxInt = intBuf[y];
          }

          gCtx.beginPath();
          gCtx.strokeStyle = '#38bdf8';
          gCtx.lineWidth = 2;
          for (let y = 0; y < GRID_H; y++) {
            const pixelY = (y / GRID_H) * gh;
            const normInt = intBuf[y] / Math.max(0.01, maxInt);
            const pixelX = normInt * (gw - 20) + 5;
            if (y === 0) {
              gCtx.moveTo(pixelX, pixelY);
            } else {
              gCtx.lineTo(pixelX, pixelY);
            }
          }
          gCtx.stroke();

          // Title
          gCtx.fillStyle = '#94a3b8';
          gCtx.font = '10px sans-serif';
          gCtx.fillText('간섭 세기 I(y)', 8, 14);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, timeScale, frequency, damping, colorScheme, activePreset]);

  // Canvas interaction (Ripple / Draw barrier / Erase)
  const handleCanvasAction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_W);
    const clickY = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_H);

    if (clickX < 0 || clickX >= GRID_W || clickY < 0 || clickY >= GRID_H) return;

    if (drawMode === 'ripple') {
      // Inject sharp pulse
      const r = 4;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = clickX + dx;
          const gy = clickY + dy;
          if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
            uCurr.current[gy * GRID_W + gx] = 2.5 * Math.exp(-(dx * dx + dy * dy) / 4);
          }
        }
      }
      playBlip(700, 0.05);
    } else if (drawMode === 'wall') {
      const r = 2;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = clickX + dx;
          const gy = clickY + dy;
          if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
            barriers.current[gy * GRID_W + gx] = 1;
          }
        }
      }
    } else if (drawMode === 'eraser') {
      const r = 4;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = clickX + dx;
          const gy = clickY + dy;
          if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
            barriers.current[gy * GRID_W + gx] = 0;
          }
        }
      }
    }
  };

  const handleResetWave = () => {
    setupPreset(activePreset, slitDistance, slitWidth);
    playBlip(400, 0.06);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* 2D Wave Tank Simulation Canvas + Intensity Screen */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-[#000000] rounded-sm border border-[#222] shadow-2xl overflow-hidden min-h-[500px] flex flex-row"
      >
        {/* Main 2D Ripple Wave Tank */}
        <div className="flex-1 relative h-full">
          <canvas
            ref={canvasRef}
            width={640}
            height={440}
            onClick={handleCanvasAction}
            onMouseMove={(e) => {
              if (e.buttons === 1 && (drawMode === 'wall' || drawMode === 'eraser')) {
                handleCanvasAction(e);
              }
            }}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Floating Canvas Top Overlay */}
          <div className="absolute top-3 left-3 bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-sm border border-[#333] text-xs shadow-lg flex items-center gap-3 font-mono">
            <span className="text-[#00D1FF] font-bold">2D FDTD SOLVER</span>
            <div className="w-px h-3 bg-[#333]" />
            <span className="text-neutral-300">∂²u/∂t² = c² ∇²u</span>
          </div>

          {/* Canvas Bottom Tool selector */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/90 backdrop-blur-md p-1.5 rounded-sm border border-[#333] text-xs z-10 font-mono">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 px-1">TOOL:</span>
            <button
              onClick={() => setDrawMode('ripple')}
              className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all ${
                drawMode === 'ripple' ? 'bg-[#00D1FF] text-black font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]' : 'bg-[#141414] text-neutral-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>펄스 파원</span>
            </button>
            <button
              onClick={() => setDrawMode('wall')}
              className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all ${
                drawMode === 'wall' ? 'bg-[#00D1FF] text-black font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]' : 'bg-[#141414] text-neutral-300 hover:text-white'
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>장벽 그리기</span>
            </button>
            <button
              onClick={() => setDrawMode('eraser')}
              className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all ${
                drawMode === 'eraser' ? 'bg-[#00D1FF] text-black font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]' : 'bg-[#141414] text-neutral-300 hover:text-white'
              }`}
            >
              <Eraser className="w-3 h-3" />
              <span>지우개</span>
            </button>
          </div>
        </div>

        {/* Right Edge: Real-time Intensity Detector Profile */}
        <div className="w-28 sm:w-36 border-l border-[#222] bg-[#030303] flex flex-col">
          <div className="text-[9px] uppercase tracking-widest font-mono font-bold text-[#00D1FF] px-2 py-2 border-b border-[#222] text-center bg-[#080808]">
            DETECTOR PATTERN
          </div>
          <canvas
            ref={graphCanvasRef}
            width={120}
            height={440}
            className="flex-1 w-full h-full block"
          />
        </div>
      </div>

      {/* Side Controls Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-3.5 bg-[#080808] p-4 rounded-sm border border-[#222] text-sm overflow-y-auto font-sans">
        {/* Preset Selector */}
        <div>
          <label className="text-[11px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2 font-mono">
            <span className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full shadow-[0_0_6px_#00D1FF]"></span>
            파동 광학 실험 모드
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESET_INFOS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  playBlip(540, 0.05);
                  setActivePreset(preset.id);
                }}
                className={`text-left px-2.5 py-2 rounded-sm border transition-all text-xs ${
                  activePreset === preset.id
                    ? 'bg-[#1A1A1A] border-[#00D1FF] text-white shadow-[0_0_8px_rgba(0,209,255,0.2)]'
                    : 'bg-[#121212] border-[#222] hover:border-[#333]'
                }`}
              >
                <div className={`font-semibold ${activePreset === preset.id ? 'text-[#00D1FF]' : 'text-neutral-200'}`}>
                  {preset.name}
                </div>
                <div className="text-[10px] font-mono text-neutral-500 line-clamp-1 mt-0.5">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[#1F1F1F]" />

        {/* Physics Sliders */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-white uppercase tracking-widest flex items-center gap-2 font-mono">
            <span className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full"></span>
            광학 파라미터 조절
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-neutral-300 mb-1">
              <span>FREQUENCY (f)</span>
              <span className="text-[#00D1FF]">{frequency.toFixed(2)} Hz</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={frequency}
              onChange={(e) => setFrequency(parseFloat(e.target.value))}
              aria-label="파동 주파수"
              className="w-full"
            />
          </div>

          {(activePreset === 'double-slit' || activePreset === 'two-sources') && (
            <div>
              <div className="flex justify-between text-xs font-mono text-neutral-300 mb-1">
                <span>SLIT DISTANCE (d)</span>
                <span className="text-[#00D1FF]">{slitDistance} px</span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                step="2"
                value={slitDistance}
                onChange={(e) => setSlitDistance(parseInt(e.target.value))}
                aria-label="슬릿 간격"
                className="w-full"
              />
            </div>
          )}

          {(activePreset === 'double-slit' || activePreset === 'single-slit' || activePreset === 'grating') && (
            <div>
              <div className="flex justify-between text-xs font-mono text-neutral-300 mb-1">
                <span>SLIT WIDTH (w)</span>
                <span className="text-[#00D1FF]">{slitWidth} px</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={slitWidth}
                onChange={(e) => setSlitWidth(parseInt(e.target.value))}
                aria-label="슬릿 폭"
                className="w-full"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs font-mono text-neutral-300 mb-1">
              <span>DAMPING RATE (γ)</span>
              <span className="text-[#00D1FF]">{(damping * 1000).toFixed(1)} m⁻¹</span>
            </div>
            <input
              type="range"
              min="0.0005"
              max="0.01"
              step="0.0005"
              value={damping}
              onChange={(e) => setDamping(parseFloat(e.target.value))}
              aria-label="감쇠율"
              className="w-full"
            />
          </div>
        </div>

        <div className="h-px bg-[#1F1F1F]" />

        {/* Color Palette Selector */}
        <div>
          <label className="text-[11px] font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2 font-mono">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
            COLOR PALETTE
          </label>
          <div className="grid grid-cols-2 gap-1.5 font-mono">
            {[
              { id: 'cyan', label: 'CYAN LASER' },
              { id: 'emerald', label: 'EMERALD BEAM' },
              { id: 'thermal', label: 'THERMAL SPEC' },
              { id: 'purple', label: 'QUANTUM PSI' }
            ].map(pal => (
              <button
                key={pal.id}
                onClick={() => setColorScheme(pal.id as any)}
                className={`py-1.5 px-2 rounded-sm text-xs border transition-all ${
                  colorScheme === pal.id
                    ? 'bg-[#00D1FF] border-[#00D1FF] text-black font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]'
                    : 'bg-[#141414] border-[#333] text-neutral-300 hover:bg-[#1E1E1E]'
                }`}
              >
                {pal.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={handleResetWave}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-neutral-200 border border-[#333] text-xs font-mono font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>파동 수조 초기화</span>
          </button>
        </div>
      </div>
    </div>
  );
};
