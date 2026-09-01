import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GasParticle } from '../types';
import { 
  Flame, 
  Snowflake, 
  Plus, 
  Minus, 
  RotateCcw, 
  Activity, 
  Gauge, 
  Layers, 
  ArrowDownUp
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface ThermoLabProps {
  isRunning: boolean;
  timeScale: number;
}

export const ThermoLab: React.FC<ThermoLabProps> = ({ isRunning, timeScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Thermodynamic State Variables
  const [temperature, setTemperature] = useState<number>(300); // Kelvin (50K ~ 1000K)
  const [pistonHeightPercent, setPistonHeightPercent] = useState<number>(0.75); // 0.35 ~ 0.95
  const [gravityOnPiston, setGravityOnPiston] = useState<boolean>(false);
  const [heatingRate, setHeatingRate] = useState<number>(0); // -1 (cooling), 0 (none), +1 (heating)

  // Particle counts
  const [lightCount, setLightCount] = useState<number>(80);
  const [heavyCount, setHeavyCount] = useState<number>(40);

  // Live Telemetry
  const [pressure, setPressure] = useState<number>(1.0);
  const [avgSpeed, setAvgSpeed] = useState<number>(0);
  const [pvValue, setPvValue] = useState<number>(0);

  // Particle refs
  const particlesRef = useRef<GasParticle[]>([]);
  const wallImpulseAccumulator = useRef<number>(0);
  const lastImpulseTime = useRef<number>(Date.now());
  const smoothedPressure = useRef<number>(1.0);

  // Initialize Particles
  const initParticles = useCallback((light: number, heavy: number, temp: number, pH: number) => {
    const newParticles: GasParticle[] = [];
    const baseSpeedLight = Math.sqrt(temp / 10) * 1.6;
    const baseSpeedHeavy = Math.sqrt(temp / 40) * 1.6;

    let id = 0;
    // Light particles (Helium-like, mass = 1, cyan)
    for (let i = 0; i < light; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeedLight * (0.6 + Math.random() * 0.8);
      newParticles.push({
        id: id++,
        x: 40 + Math.random() * 240,
        y: 60 + Math.random() * (pH * 300),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4,
        mass: 1.0,
        color: '#38bdf8'
      });
    }

    // Heavy particles (Xenon-like, mass = 4, rose)
    for (let i = 0; i < heavy; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeedHeavy * (0.6 + Math.random() * 0.8);
      newParticles.push({
        id: id++,
        x: 40 + Math.random() * 240,
        y: 60 + Math.random() * (pH * 300),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6.5,
        mass: 4.0,
        color: '#f43f5e'
      });
    }

    particlesRef.current = newParticles;
  }, []);

  useEffect(() => {
    initParticles(lightCount, heavyCount, temperature, pistonHeightPercent);
  }, [initParticles]);

  // Handle Dynamic Heating/Cooling
  useEffect(() => {
    if (heatingRate === 0) return;
    const timer = setInterval(() => {
      setTemperature(prev => {
        const next = Math.max(50, Math.min(1000, prev + heatingRate * 15));
        // Thermalize particle velocities gradually
        const speedScale = Math.sqrt(next / Math.max(1, prev));
        particlesRef.current.forEach(p => {
          p.vx *= (0.95 + 0.05 * speedScale);
          p.vy *= (0.95 + 0.05 * speedScale);
        });
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [heatingRate]);

  // Main Canvas & Physics Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const histCanvas = histCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Chamber Geometry
      const chamberLeft = 60;
      const chamberRight = w - 60;
      const chamberBottom = h - 60;
      const chamberTopLimit = 70;
      const chamberWidth = chamberRight - chamberLeft;
      const chamberMaxHeight = chamberBottom - chamberTopLimit;

      const pistonY = chamberBottom - chamberMaxHeight * pistonHeightPercent;
      const pistonThickness = 18;

      // 1. Clear background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // Chamber glass fill
      ctx.fillStyle = '#0f172a60';
      ctx.fillRect(chamberLeft, pistonY, chamberWidth, chamberBottom - pistonY);

      // Burner Glow at bottom
      if (heatingRate > 0) {
        const grad = ctx.createLinearGradient(chamberLeft, chamberBottom, chamberLeft, chamberBottom - 40);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(chamberLeft, chamberBottom - 40, chamberWidth, 40);
      } else if (heatingRate < 0) {
        const grad = ctx.createLinearGradient(chamberLeft, chamberBottom, chamberLeft, chamberBottom - 40);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(chamberLeft, chamberBottom - 40, chamberWidth, 40);
      }

      // Physics Integration & Collisions
      const particles = particlesRef.current;
      let totalSpeed = 0;
      const speedList: number[] = [];

      if (isRunning) {
        const dt = 0.5 * timeScale;
        const subSteps = 2;
        const subDt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            p.x += p.vx * subDt;
            p.y += p.vy * subDt;

            // Left / Right Wall Collisions
            if (p.x - p.radius < chamberLeft) {
              p.x = chamberLeft + p.radius;
              p.vx = -p.vx;
              wallImpulseAccumulator.current += 2 * p.mass * Math.abs(p.vx);
            } else if (p.x + p.radius > chamberRight) {
              p.x = chamberRight - p.radius;
              p.vx = -p.vx;
              wallImpulseAccumulator.current += 2 * p.mass * Math.abs(p.vx);
            }

            // Bottom Wall Collision (Thermalized by heater/cooler)
            if (p.y + p.radius > chamberBottom) {
              p.y = chamberBottom - p.radius;
              p.vy = -Math.abs(p.vy);

              // Thermalize slightly with target temperature
              const targetV = Math.sqrt((temperature / (10 * p.mass))) * (0.8 + Math.random() * 0.4);
              p.vy = -targetV;
              wallImpulseAccumulator.current += 2 * p.mass * Math.abs(p.vy);
            }

            // Top Piston Collision
            if (p.y - p.radius < pistonY + pistonThickness) {
              p.y = pistonY + pistonThickness + p.radius;
              p.vy = Math.abs(p.vy);
              wallImpulseAccumulator.current += 2 * p.mass * Math.abs(p.vy);
            }
          }

          // Pairwise Elastic Particle-Particle Collisions
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const p1 = particles[i];
              const p2 = particles[j];
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < p1.radius + p2.radius && dist > 0.001) {
                // Normal & Tangent vectors
                const nx = dx / dist;
                const ny = dy / dist;

                // Relative velocity
                const kx = p1.vx - p2.vx;
                const ky = p1.vy - p2.vy;
                const p = 2 * (nx * kx + ny * ky) / (p1.mass + p2.mass);

                if (nx * kx + ny * ky > 0) {
                  p1.vx -= p * p2.mass * nx;
                  p1.vy -= p * p2.mass * ny;
                  p2.vx += p * p1.mass * nx;
                  p2.vy += p * p1.mass * ny;
                }

                // Positional overlap resolution
                const overlap = (p1.radius + p2.radius - dist) * 0.5;
                p1.x -= nx * overlap;
                p1.y -= ny * overlap;
                p2.x += nx * overlap;
                p2.y += ny * overlap;
              }
            }
          }
        }
      }

      // Collect particle telemetry
      for (const p of particles) {
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        totalSpeed += spd;
        speedList.push(spd);

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 2. Draw Chamber Walls & Piston
      // Heavy Metallic Chamber Border
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(chamberLeft - 2, chamberTopLimit - 20);
      ctx.lineTo(chamberLeft - 2, chamberBottom + 2);
      ctx.lineTo(chamberRight + 2, chamberBottom + 2);
      ctx.lineTo(chamberRight + 2, chamberTopLimit - 20);
      ctx.stroke();

      // Piston Head
      const gradPiston = ctx.createLinearGradient(chamberLeft, pistonY, chamberRight, pistonY);
      gradPiston.addColorStop(0, '#64748b');
      gradPiston.addColorStop(0.5, '#cbd5e1');
      gradPiston.addColorStop(1, '#64748b');
      ctx.fillStyle = gradPiston;
      ctx.fillRect(chamberLeft, pistonY, chamberWidth, pistonThickness);

      // Piston Rod
      const midX = (chamberLeft + chamberRight) / 2;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(midX - 8, pistonY - 45, 16, 45);

      // Piston Top Handle
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(midX - 24, pistonY - 52, 48, 8);

      // 3. Pressure Calculation (smoothed over time)
      const now = Date.now();
      const elapsed = (now - lastImpulseTime.current) / 1000;
      if (elapsed > 0.25) {
        const area = (chamberWidth + 2 * (chamberBottom - pistonY));
        const rawPressure = (wallImpulseAccumulator.current / Math.max(0.01, elapsed)) / Math.max(10, area);
        const targetP = rawPressure * 0.22;
        smoothedPressure.current = smoothedPressure.current * 0.6 + targetP * 0.4;
        setPressure(Math.max(0.1, parseFloat(smoothedPressure.current.toFixed(2))));
        setAvgSpeed(parseFloat((totalSpeed / Math.max(1, particles.length)).toFixed(1)));
        setPvValue(parseFloat((smoothedPressure.current * (chamberBottom - pistonY) * 0.05).toFixed(1)));

        wallImpulseAccumulator.current = 0;
        lastImpulseTime.current = now;
      }

      // 4. Render Maxwell-Boltzmann Velocity Distribution Histogram
      if (histCanvas) {
        const hCtx = histCanvas.getContext('2d');
        if (hCtx) {
          const hw = histCanvas.width;
          const hh = histCanvas.height;

          hCtx.fillStyle = '#090d16';
          hCtx.fillRect(0, 0, hw, hh);

          // Bin speeds
          const numBins = 24;
          const maxSpeedBin = 20;
          const bins = new Array(numBins).fill(0);
          for (const spd of speedList) {
            const bIdx = Math.min(numBins - 1, Math.floor((spd / maxSpeedBin) * numBins));
            bins[bIdx]++;
          }

          const maxBinCount = Math.max(1, Math.max(...bins));
          const binWidth = hw / numBins;

          // Draw Bars
          for (let b = 0; b < numBins; b++) {
            const barH = (bins[b] / maxBinCount) * (hh - 22);
            const x = b * binWidth;
            const y = hh - barH - 4;

            const grad = hCtx.createLinearGradient(0, y, 0, hh);
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(1, '#0284c7');
            hCtx.fillStyle = grad;
            hCtx.fillRect(x + 1, y, binWidth - 2, barH);
          }

          // Theoretical Maxwell-Boltzmann smooth curve overlay
          hCtx.beginPath();
          hCtx.strokeStyle = '#f43f5e';
          hCtx.lineWidth = 1.8;
          const a = temperature / 35; // scale parameter
          for (let px = 0; px < hw; px += 3) {
            const v = (px / hw) * maxSpeedBin;
            // 2D Maxwell-Boltzmann: f(v) = (v/a) * exp(-v^2 / (2a))
            const theoretical = (v / Math.max(1, a)) * Math.exp(-(v * v) / (2 * Math.max(1, a)));
            const py = hh - theoretical * 2.2 * (hh - 22) - 4;
            if (px === 0) hCtx.moveTo(px, py);
            else hCtx.lineTo(px, py);
          }
          hCtx.stroke();

          // Title
          hCtx.fillStyle = '#94a3b8';
          hCtx.font = '10px sans-serif';
          hCtx.fillText('맥스웰-볼츠만 속도 분포 f(v)', 6, 12);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, timeScale, pistonHeightPercent, temperature, heatingRate]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Simulation Piston Canvas & Live Distribution Chart */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-slate-950 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden min-h-[500px] flex flex-col sm:flex-row"
      >
        {/* Main Piston Cylinder */}
        <div className="flex-1 relative h-full">
          <canvas
            ref={canvasRef}
            width={480}
            height={440}
            className="w-full h-full block"
          />

          {/* Floating Live Telemetry Gauge */}
          <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg flex items-center gap-3 font-mono">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Gauge className="w-3.5 h-3.5" />
              <span>압력 $P$: <strong className="text-white">{pressure} atm</strong></span>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div className="text-cyan-400">
              온도 $T$: <strong className="text-white">{temperature} K</strong>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div className="text-rose-400">
              $PV$: <strong className="text-white">{pvValue}</strong>
            </div>
          </div>

          {/* Burner Controls Bottom Floating Bar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-800 text-xs shadow-xl">
            <button
              onMouseDown={() => {
                playBlip(320, 0.05);
                setHeatingRate(-1);
              }}
              onMouseUp={() => setHeatingRate(0)}
              onMouseLeave={() => setHeatingRate(0)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 font-medium transition-all active:scale-95"
            >
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              <span>냉각 (Ice)</span>
            </button>

            <div className="text-slate-400 font-mono text-[11px] px-1">
              버너 제어
            </div>

            <button
              onMouseDown={() => {
                playBlip(580, 0.05);
                setHeatingRate(1);
              }}
              onMouseUp={() => setHeatingRate(0)}
              onMouseLeave={() => setHeatingRate(0)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 font-medium transition-all active:scale-95"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>가열 (Heat)</span>
            </button>
          </div>
        </div>

        {/* Right Panel: Maxwell-Boltzmann Distribution Graph */}
        <div className="w-full sm:w-56 border-t sm:border-t-0 sm:border-l border-slate-800 bg-slate-950 flex flex-col">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <span>속도 분포 통계</span>
            <span className="text-cyan-400 font-mono">v_rms: {avgSpeed}</span>
          </div>
          <canvas
            ref={histCanvasRef}
            width={200}
            height={200}
            className="w-full h-44 sm:h-52 block"
          />

          <div className="p-3 text-[11px] text-slate-400 space-y-2 border-t border-slate-800/80 bg-slate-900/40 mt-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>가벼운 분자 (He, m=1) : {lightCount}개</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>무거운 분자 (Xe, m=4) : {heavyCount}개</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1 leading-relaxed">
              * 동일 온도에서 가벼운 분자의 평균 속도가 더 빠르고 속도 분포가 우측으로 완만해집니다 (v_rms = √(3k_B T / M)).
            </p>
          </div>
        </div>
      </div>

      {/* Side Controls & Gas Laws Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-3.5 bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80 text-sm overflow-y-auto">
        <div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <ArrowDownUp className="w-3.5 h-3.5 text-cyan-400" />
            피스톤 부피 및 온도 제어
          </label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>실린더 부피 ($V$)</span>
                <span className="font-mono text-cyan-400">{(pistonHeightPercent * 100).toFixed(0)} %</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.95"
                step="0.01"
                value={pistonHeightPercent}
                onChange={(e) => setPistonHeightPercent(parseFloat(e.target.value))}
                aria-label="실린더 부피"
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>절대 온도 ($T$)</span>
                <span className="font-mono text-amber-400">{temperature} K</span>
              </div>
              <input
                type="range"
                min="60"
                max="900"
                step="10"
                value={temperature}
                onChange={(e) => {
                  const newT = parseInt(e.target.value);
                  setTemperature(newT);
                  const scale = Math.sqrt(newT / Math.max(1, temperature));
                  particlesRef.current.forEach(p => {
                    p.vx *= scale;
                    p.vy *= scale;
                  });
                }}
                aria-label="절대 온도"
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Particle Management */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            기체 분자 주입 및 구성
          </label>

          <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
            <span className="text-xs text-cyan-300 font-medium">가벼운 기체 (질량 1)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLightCount(c => Math.max(0, c - 20))}
                className="p-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono text-xs w-8 text-center">{lightCount}</span>
              <button
                onClick={() => setLightCount(c => Math.min(200, c + 20))}
                className="p-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
            <span className="text-xs text-rose-300 font-medium">무거운 기체 (질량 4)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHeavyCount(c => Math.max(0, c - 10))}
                className="p-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono text-xs w-8 text-center">{heavyCount}</span>
              <button
                onClick={() => setHeavyCount(c => Math.min(100, c + 10))}
                className="p-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* State Equation Info */}
        <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
          <div className="font-semibold text-cyan-400">💡 이상 기체 법칙 (PV = nRT)</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            부피($V$)를 줄이면 분자들의 벽면 충돌 빈도가 급증하여 압력($P$)이 상승하며(보일의 법칙), 온도를 높이면 분자 평균 운동 에너지가 증가합니다(샤를의 법칙).
          </p>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={() => {
              playBlip(400, 0.05);
              setTemperature(300);
              setPistonHeightPercent(0.75);
              setLightCount(80);
              setHeavyCount(40);
              initParticles(80, 40, 300, 0.75);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>실린더 초기화</span>
          </button>
        </div>
      </div>
    </div>
  );
};
