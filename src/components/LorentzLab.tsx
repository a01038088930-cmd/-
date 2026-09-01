import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LorentzParticle } from '../types';
import { 
  Zap, 
  RotateCcw, 
  Layers, 
  Sparkles, 
  Play, 
  Compass, 
  Sliders, 
  Flame,
  Plus
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface LorentzLabProps {
  isRunning: boolean;
  timeScale: number;
}

type LorentzPreset = 'cyclotron' | 'thomson' | 'selector' | 'spectrometer' | 'dipole';

const PRESET_SPECS: { id: LorentzPreset; name: string; desc: string }[] = [
  { id: 'cyclotron', name: '사이클로트론 원운동 (Cyclotron)', desc: '수직 자기장 B에 의한 등속 원운동과 라모어 회전 반경 r = mv / qB' },
  { id: 'selector', name: '속도 선택기 (Velocity Selector)', desc: '직교하는 E와 B 필드에서 특정 속도 v = E / B 인 입자만 직진 통과' },
  { id: 'thomson', name: '톰슨 음극선관 (Cathode Ray Tube)', desc: '전기장에 의한 전자빔의 포물선 편향과 비전하 e/m 측정' },
  { id: 'spectrometer', name: '질량 분석기 (Mass Spectrometer)', desc: '전하 대 질량비(q/m)에 따른 동위원소 궤적 곡률 분리' },
  { id: 'dipole', name: '불균일 자기장 병 (Magnetic Trap)', desc: '자기력선 수렴 영역에서의 하전 입자 반사 및 밴 앨런대 포획' },
];

export const LorentzLab: React.FC<LorentzLabProps> = ({ isRunning, timeScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Field Parameters
  const [bField, setBField] = useState<number>(1.2); // Magnetic field (-3.0 to +3.0 Tesla/scale)
  const [eFieldX, setEFieldX] = useState<number>(0.0);
  const [eFieldY, setEFieldY] = useState<number>(0.0);
  const [activePreset, setActivePreset] = useState<LorentzPreset>('cyclotron');

  // Particle Gun Configuration
  const [particleType, setParticleType] = useState<'electron' | 'proton' | 'alpha' | 'positron'>('electron');
  const [gunSpeed, setGunSpeed] = useState<number>(6.0);
  const [autoFire, setAutoFire] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);

  // Active particles
  const particles = useRef<LorentzParticle[]>([]);
  const lastFireTime = useRef<number>(0);

  // Telemetry stats
  const [stats, setStats] = useState({
    activeCount: 0,
    cyclotronRadius: 0,
    cyclotronPeriod: 0,
  });

  // Apply Preset configurations
  const applyPreset = useCallback((preset: LorentzPreset) => {
    setActivePreset(preset);
    particles.current = [];

    if (preset === 'cyclotron') {
      setBField(1.2);
      setEFieldX(0);
      setEFieldY(0);
      setParticleType('electron');
      setGunSpeed(6.0);
    } else if (preset === 'selector') {
      setBField(1.0);
      setEFieldX(0);
      setEFieldY(6.0); // E = v * B = 6.0 * 1.0 = 6.0
      setParticleType('electron');
      setGunSpeed(6.0);
    } else if (preset === 'thomson') {
      setBField(0);
      setEFieldX(0);
      setEFieldY(3.5);
      setParticleType('electron');
      setGunSpeed(5.5);
    } else if (preset === 'spectrometer') {
      setBField(1.5);
      setEFieldX(0);
      setEFieldY(0);
      setParticleType('alpha');
      setGunSpeed(5.0);
    } else if (preset === 'dipole') {
      setBField(2.0);
      setEFieldX(0.5);
      setEFieldY(0);
      setParticleType('electron');
      setGunSpeed(4.5);
    }

    playBlip(560, 0.06);
  }, []);

  // Spawn Particle Helper
  const spawnParticle = useCallback((type: 'electron' | 'proton' | 'alpha' | 'positron', speed: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let q = -1;
    let m = 1;
    let color = '#38bdf8';

    if (type === 'electron') {
      q = -1;
      m = 1;
      color = '#38bdf8';
    } else if (type === 'proton') {
      q = 1;
      m = 12; // Scaled for visible motion
      color = '#f43f5e';
    } else if (type === 'alpha') {
      q = 2;
      m = 24;
      color = '#fbbf24';
    } else if (type === 'positron') {
      q = 1;
      m = 1;
      color = '#34d399';
    }

    let startX = 60;
    let startY = canvas.height / 2;
    let vx = speed;
    let vy = 0;

    if (activePreset === 'cyclotron') {
      startX = canvas.width / 2;
      startY = canvas.height / 2 + 50;
      vx = speed;
      vy = 0;
    }

    const newP: LorentzParticle = {
      id: Date.now() + Math.random(),
      x: startX,
      y: startY,
      vx,
      vy,
      q,
      m,
      color,
      trail: []
    };

    particles.current.push(newP);
    if (particles.current.length > 50) {
      particles.current.shift();
    }
  }, [activePreset]);

  // Main Canvas & Lorentz Motion Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // 2. Render Field Grid Visualizers
      // Magnetic Field Visualizer (Circles with dot ⊙ or cross ⊗)
      const fieldSpacing = 50;
      if (Math.abs(bField) > 0.05) {
        ctx.fillStyle = bField > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)';
        ctx.strokeStyle = bField > 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.35)';
        ctx.lineWidth = 1;

        for (let x = fieldSpacing; x < w; x += fieldSpacing) {
          for (let y = fieldSpacing; y < h; y += fieldSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.stroke();

            if (bField > 0) {
              // Out of screen ⊙ (dot)
              ctx.beginPath();
              ctx.arc(x, y, 2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Into screen ⊗ (cross)
              ctx.beginPath();
              ctx.moveTo(x - 3.5, y - 3.5);
              ctx.lineTo(x + 3.5, y + 3.5);
              ctx.moveTo(x + 3.5, y - 3.5);
              ctx.lineTo(x - 3.5, y + 3.5);
              ctx.stroke();
            }
          }
        }
      }

      // Electric Field Vector Grid Arrows (E)
      const eMagnitude = Math.sqrt(eFieldX * eFieldX + eFieldY * eFieldY);
      if (eMagnitude > 0.1) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.lineWidth = 1.2;

        const eAngle = Math.atan2(eFieldY, eFieldX);
        const arrowLen = Math.min(22, eMagnitude * 3.5);

        for (let x = 40; x < w; x += 60) {
          for (let y = 40; y < h; y += 60) {
            const endX = x + Math.cos(eAngle) * arrowLen;
            const endY = y + Math.sin(eAngle) * arrowLen;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - 4 * Math.cos(eAngle - Math.PI / 6), endY - 4 * Math.sin(eAngle - Math.PI / 6));
            ctx.lineTo(endX - 4 * Math.cos(eAngle + Math.PI / 6), endY - 4 * Math.sin(eAngle + Math.PI / 6));
            ctx.fill();
          }
        }
      }

      // 3. Auto-fire particle generator
      const now = Date.now();
      if (isRunning && autoFire && now - lastFireTime.current > 450 / timeScale) {
        spawnParticle(particleType, gunSpeed);
        lastFireTime.current = now;
      }

      // 4. Physics Integration (Lorentz Force: F = q*(E + v x B))
      const currentParticles = particles.current;
      if (isRunning && currentParticles.length > 0) {
        const dt = 0.4 * timeScale;
        const subSteps = 4;
        const subDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
          for (let i = currentParticles.length - 1; i >= 0; i--) {
            const p = currentParticles[i];

            // Magnetic Force in 2D (v x B):
            // v = (vx, vy, 0), B = (0, 0, B)
            // v x B = (vy*B, -vx*B, 0)
            const fMagX = p.q * (p.vy * bField);
            const fMagY = p.q * (-p.vx * bField);

            // Electric Force: F_e = q * E
            const fElecX = p.q * eFieldX;
            const fElecY = p.q * eFieldY;

            // Total Acceleration: a = (F_mag + F_elec) / m
            const ax = (fMagX + fElecX) / p.m;
            const ay = (fMagY + fElecY) / p.m;

            p.vx += ax * subDt;
            p.vy += ay * subDt;

            p.x += p.vx * subDt;
            p.y += p.vy * subDt;

            // Record trail
            if (s === 0) {
              p.trail.push({ x: p.x, y: p.y });
              if (p.trail.length > 80) p.trail.shift();
            }

            // Remove offscreen
            if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) {
              currentParticles.splice(i, 1);
            }
          }
        }
      }

      // 5. Render Particle Trails
      for (const p of currentParticles) {
        if (p.trail.length > 1) {
          ctx.beginPath();
          for (let i = 0; i < p.trail.length; i++) {
            const pt = p.trail[i];
            const alpha = (i / p.trail.length) * 0.8;
            ctx.strokeStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 2;
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }

      // 6. Render Particles & Vector Overlays
      for (const p of currentParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.q > 0 ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Charge symbol (+ or -)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.q > 0 ? '+' : '−', p.x, p.y + 3);

        // Vector Overlays
        if (showVectors) {
          // Velocity vector (cyan)
          const vScale = 4;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * vScale, p.y + p.vy * vScale);
          ctx.stroke();

          // Lorentz Magnetic Force vector (rose)
          const fMagX = p.q * (p.vy * bField);
          const fMagY = p.q * (-p.vx * bField);
          const fScale = 4;
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + fMagX * fScale, p.y + fMagY * fScale);
          ctx.stroke();
        }
      }

      // Update Telemetry
      const rTheoretical = Math.abs((1 * gunSpeed) / (1 * Math.max(0.01, bField))).toFixed(1);
      const periodTheoretical = (2 * Math.PI * 1 / Math.abs(1 * Math.max(0.01, bField))).toFixed(1);
      setStats({
        activeCount: currentParticles.length,
        cyclotronRadius: parseFloat(rTheoretical),
        cyclotronPeriod: parseFloat(periodTheoretical),
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, timeScale, bField, eFieldX, eFieldY, autoFire, particleType, gunSpeed, showVectors, spawnParticle]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Simulation Interactive Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-slate-950 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden min-h-[500px] flex flex-col"
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={460}
          onClick={() => {
            spawnParticle(particleType, gunSpeed);
            playBlip(720, 0.04);
          }}
          className="w-full h-full block cursor-pointer"
        />

        {/* Floating Telemetry & Formula overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg flex items-center gap-3 font-mono">
          <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>F = q(E + v × B)</span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="text-amber-400">
            회전 반경 r: <strong className="text-white">{stats.cyclotronRadius} px</strong>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="text-emerald-400">
            입자 수: <strong className="text-white">{stats.activeCount}</strong>
          </div>
        </div>

        {/* Canvas Bottom Tooltip & Quick manual launch */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none text-slate-400 text-xs z-10">
          <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-800/60">
            💡 캔버스를 <strong>클릭</strong>하여 현재 설정된 전하 입자를 즉시 단발 발사하세요.
          </div>
          <button
            onClick={() => {
              particles.current = [];
              playBlip(350, 0.05);
            }}
            className="pointer-events-auto bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            입자 비우기
          </button>
        </div>
      </div>

      {/* Side Control Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-3.5 bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80 text-sm overflow-y-auto">
        {/* Preset Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            전자기학 실험 프리셋
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESET_SPECS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`text-left px-2.5 py-2 rounded-xl border transition-all text-xs ${
                  activePreset === preset.id
                    ? 'bg-slate-800 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className={`font-semibold ${activePreset === preset.id ? 'text-cyan-300' : 'text-slate-200'}`}>
                  {preset.name}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Field Controls */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            전자기장 ($E$, $B$) 강도 조절
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>자기장 ($B_z$) [⊙/⊗]</span>
              <span className="font-mono text-cyan-400">{bField.toFixed(2)} T</span>
            </div>
            <input
              type="range"
              min="-2.5"
              max="2.5"
              step="0.1"
              value={bField}
              onChange={(e) => setBField(parseFloat(e.target.value))}
              aria-label="자기장 강도"
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>수직 전기장 ($E_y$)</span>
              <span className="font-mono text-amber-400">{eFieldY.toFixed(1)} N/C</span>
            </div>
            <input
              type="range"
              min="-8.0"
              max="8.0"
              step="0.5"
              value={eFieldY}
              onChange={(e) => setEFieldY(parseFloat(e.target.value))}
              aria-label="수직 전기장"
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Particle Gun Config */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            입자 총 (Particle Gun)
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'electron', label: '전자 (e⁻)', color: 'text-cyan-300' },
              { id: 'proton', label: '양성자 (p⁺)', color: 'text-rose-300' },
              { id: 'alpha', label: '알파입자 (α²⁺)', color: 'text-amber-300' },
              { id: 'positron', label: '양전자 (e⁺)', color: 'text-emerald-300' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setParticleType(p.id as any)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                  particleType === p.id
                    ? 'bg-slate-700 border-cyan-400 text-white shadow font-semibold'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={p.color}>{p.label}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>초기 발사 속도 ($v_0$)</span>
              <span className="font-mono text-cyan-400">{gunSpeed.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="12.0"
              step="0.5"
              value={gunSpeed}
              onChange={(e) => setGunSpeed(parseFloat(e.target.value))}
              aria-label="초기 발사 속도"
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoFire}
                onChange={(e) => setAutoFire(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <span>연속 빔 발사 (Beam)</span>
            </label>

            <button
              onClick={() => setShowVectors(!showVectors)}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              벡터 표시: {showVectors ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={() => {
              spawnParticle(particleType, gunSpeed);
              playBlip(720, 0.04);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>단발 입자 발사</span>
          </button>
        </div>
      </div>
    </div>
  );
};
