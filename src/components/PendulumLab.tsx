import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Activity, 
  RotateCcw, 
  Layers, 
  Sparkles, 
  GitBranch, 
  Eye, 
  Maximize2
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface PendulumLabProps {
  isRunning: boolean;
  timeScale: number;
}

interface PendulumState {
  theta1: number;
  theta2: number;
  omega1: number;
  omega2: number;
}

export const PendulumLab: React.FC<PendulumLabProps> = ({ isRunning, timeScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Physics Parameters
  const [l1, setL1] = useState<number>(140);
  const [l2, setL2] = useState<number>(120);
  const [m1, setM1] = useState<number>(15);
  const [m2, setM2] = useState<number>(12);
  const [g, setG] = useState<number>(9.81);
  const [damping, setDamping] = useState<number>(0.0005);
  const [showTwin, setShowTwin] = useState<boolean>(true); // Twin pendulum for Butterfly effect
  const [trailLength, setTrailLength] = useState<number>(350);

  // State of Pendulum 1 & Twin Pendulum 2 (micro-offset delta = 0.0001 rad)
  const state1 = useRef<PendulumState>({ theta1: Math.PI * 0.65, theta2: Math.PI * 0.85, omega1: 0, omega2: 0 });
  const state2 = useRef<PendulumState>({ theta1: Math.PI * 0.65 + 0.0001, theta2: Math.PI * 0.85, omega1: 0, omega2: 0 });

  const trail1 = useRef<{ x: number; y: number }[]>([]);
  const trail2 = useRef<{ x: number; y: number }[]>([]);
  const phaseTrail = useRef<{ t1: number; t2: number }[]>([]);

  // Dragging interaction state
  const isDragging = useRef<'bob1' | 'bob2' | null>(null);

  // Telemetry
  const [telemetry, setTelemetry] = useState({
    kineticEnergy: 0,
    potentialEnergy: 0,
    totalEnergy: 0,
    divergence: 0,
  });

  // RK4 (Runge-Kutta 4th Order) Derivatives for Double Pendulum
  const getDerivatives = (s: PendulumState, l1: number, l2: number, m1: number, m2: number, g: number, damp: number) => {
    const { theta1, theta2, omega1, omega2 } = s;
    const delta = theta1 - theta2;

    const den1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
    const num1 = -g * (2 * m1 + m2) * Math.sin(theta1) - m2 * g * Math.sin(theta1 - 2 * theta2) - 2 * Math.sin(delta) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(delta));
    const alpha1 = (num1 / den1) - damp * omega1;

    const den2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
    const num2 = 2 * Math.sin(delta) * (omega1 * omega1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(theta1) + omega2 * omega2 * l2 * m2 * Math.cos(delta));
    const alpha2 = (num2 / den2) - damp * omega2;

    return {
      dTheta1: omega1,
      dTheta2: omega2,
      dOmega1: alpha1,
      dOmega2: alpha2,
    };
  };

  const rk4Step = (s: PendulumState, dt: number, l1: number, l2: number, m1: number, m2: number, g: number, damp: number): PendulumState => {
    const k1 = getDerivatives(s, l1, l2, m1, m2, g, damp);

    const s2: PendulumState = {
      theta1: s.theta1 + 0.5 * dt * k1.dTheta1,
      theta2: s.theta2 + 0.5 * dt * k1.dTheta2,
      omega1: s.omega1 + 0.5 * dt * k1.dOmega1,
      omega2: s.omega2 + 0.5 * dt * k1.dOmega2,
    };
    const k2 = getDerivatives(s2, l1, l2, m1, m2, g, damp);

    const s3: PendulumState = {
      theta1: s.theta1 + 0.5 * dt * k2.dTheta1,
      theta2: s.theta2 + 0.5 * dt * k2.dTheta2,
      omega1: s.omega1 + 0.5 * dt * k2.dOmega1,
      omega2: s.omega2 + 0.5 * dt * k2.dOmega2,
    };
    const k3 = getDerivatives(s3, l1, l2, m1, m2, g, damp);

    const s4: PendulumState = {
      theta1: s.theta1 + dt * k3.dTheta1,
      theta2: s.theta2 + dt * k3.dTheta2,
      omega1: s.omega1 + dt * k3.dOmega1,
      omega2: s.omega2 + dt * k3.dOmega2,
    };
    const k4 = getDerivatives(s4, l1, l2, m1, m2, g, damp);

    return {
      theta1: s.theta1 + (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1),
      theta2: s.theta2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2),
      omega1: s.omega1 + (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1),
      omega2: s.omega2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2),
    };
  };

  // Reset function
  const resetPendulum = (th1 = Math.PI * 0.65, th2 = Math.PI * 0.85) => {
    state1.current = { theta1: th1, theta2: th2, omega1: 0, omega2: 0 };
    state2.current = { theta1: th1 + 0.0001, theta2: th2, omega1: 0, omega2: 0 };
    trail1.current = [];
    trail2.current = [];
    phaseTrail.current = [];
    playBlip(500, 0.05);
  };

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const phaseCanvas = phaseCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const pivotX = w / 2;
      const pivotY = h * 0.32;

      // 1. Clear background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Grid background
      ctx.strokeStyle = '#1e293b30';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 2. Physics Step
      if (isRunning && !isDragging.current) {
        const dt = 0.04 * timeScale;
        const subSteps = 6;
        const subDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
          state1.current = rk4Step(state1.current, subDt, l1, l2, m1, m2, g, damping);
          if (showTwin) {
            state2.current = rk4Step(state2.current, subDt, l1, l2, m1, m2, g, damping);
          }
        }
      }

      // Positions for Pendulum 1
      const s1 = state1.current;
      const x1 = pivotX + l1 * Math.sin(s1.theta1);
      const y1 = pivotY + l1 * Math.cos(s1.theta1);
      const x2 = x1 + l2 * Math.sin(s1.theta2);
      const y2 = y1 + l2 * Math.cos(s1.theta2);

      // Positions for Twin Pendulum 2
      const s2 = state2.current;
      const tx1 = pivotX + l1 * Math.sin(s2.theta1);
      const ty1 = pivotY + l1 * Math.cos(s2.theta1);
      const tx2 = tx1 + l2 * Math.sin(s2.theta2);
      const ty2 = ty1 + l2 * Math.cos(s2.theta2);

      // Record Trails
      if (isRunning) {
        trail1.current.push({ x: x2, y: y2 });
        if (trail1.current.length > trailLength) trail1.current.shift();

        if (showTwin) {
          trail2.current.push({ x: tx2, y: ty2 });
          if (trail2.current.length > trailLength) trail2.current.shift();
        }

        phaseTrail.current.push({ t1: s1.theta1, t2: s1.theta2 });
        if (phaseTrail.current.length > 250) phaseTrail.current.shift();
      }

      // Calculate Energy Telemetry
      const v1Sq = (l1 * s1.omega1) * (l1 * s1.omega1);
      const v2Sq = v1Sq + (l2 * s1.omega2) * (l2 * s1.omega2) + 2 * l1 * l2 * s1.omega1 * s1.omega2 * Math.cos(s1.theta1 - s1.theta2);
      const ke = 0.5 * m1 * v1Sq + 0.5 * m2 * v2Sq;
      const pe = -(m1 + m2) * g * l1 * Math.cos(s1.theta1) - m2 * g * l2 * Math.cos(s1.theta2);
      const distDivergence = Math.sqrt((x2 - tx2) * (x2 - tx2) + (y2 - ty2) * (y2 - ty2));

      setTelemetry({
        kineticEnergy: Math.round(ke),
        potentialEnergy: Math.round(pe),
        totalEnergy: Math.round(ke + pe),
        divergence: parseFloat(distDivergence.toFixed(1)),
      });

      // 3. Render Trails
      // Twin Trail (Rose)
      if (showTwin && trail2.current.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < trail2.current.length; i++) {
          const pt = trail2.current[i];
          const alpha = (i / trail2.current.length) * 0.7;
          ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
          }
        }
      }

      // Primary Trail (Cyan)
      if (trail1.current.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < trail1.current.length; i++) {
          const pt = trail1.current[i];
          const alpha = (i / trail1.current.length) * 0.9;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 1.8;
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
          }
        }
      }

      // 4. Render Twin Pendulum (Ghost)
      if (showTwin) {
        ctx.strokeStyle = '#f43f5e80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.stroke();

        ctx.fillStyle = '#f43f5ea0';
        ctx.beginPath();
        ctx.arc(tx1, ty1, 6, 0, Math.PI * 2);
        ctx.arc(tx2, ty2, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Render Primary Pendulum Rods & Bobs
      // Rod 1
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Rod 2
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Pivot
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Bob 1
      ctx.beginPath();
      ctx.arc(x1, y1, Math.max(7, Math.sqrt(m1) * 2.5), 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bob 2
      ctx.beginPath();
      ctx.arc(x2, y2, Math.max(9, Math.sqrt(m2) * 2.8), 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 6. Render Phase Space Canvas
      if (phaseCanvas) {
        const pCtx = phaseCanvas.getContext('2d');
        if (pCtx) {
          const pw = phaseCanvas.width;
          const ph = phaseCanvas.height;

          pCtx.fillStyle = '#090d16';
          pCtx.fillRect(0, 0, pw, ph);

          // Center cross
          pCtx.strokeStyle = '#1e293b';
          pCtx.lineWidth = 1;
          pCtx.beginPath();
          pCtx.moveTo(pw / 2, 0);
          pCtx.lineTo(pw / 2, ph);
          pCtx.moveTo(0, ph / 2);
          pCtx.lineTo(pw, ph / 2);
          pCtx.stroke();

          // Draw Phase Space Trajectory (theta1 mod 2pi vs theta2 mod 2pi)
          const pts = phaseTrail.current;
          if (pts.length > 1) {
            pCtx.beginPath();
            pCtx.strokeStyle = '#38bdf8';
            pCtx.lineWidth = 1.5;
            for (let i = 0; i < pts.length; i++) {
              const pt = pts[i];
              // map [-PI, PI] to [0, pw]
              const t1Norm = (((pt.t1 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
              const t2Norm = (((pt.t2 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
              const px = t1Norm * pw;
              const py = (1 - t2Norm) * ph;

              if (i === 0) pCtx.moveTo(px, py);
              else pCtx.lineTo(px, py);
            }
            pCtx.stroke();
          }

          // Title
          pCtx.fillStyle = '#94a3b8';
          pCtx.font = '10px sans-serif';
          pCtx.fillText('위상 공간 (θ₁ vs θ₂)', 6, 12);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, timeScale, l1, l2, m1, m2, g, damping, showTwin, trailLength]);

  // Drag interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pivotX = canvas.width / 2;
    const pivotY = canvas.height * 0.32;

    const s1 = state1.current;
    const x1 = pivotX + l1 * Math.sin(s1.theta1);
    const y1 = pivotY + l1 * Math.cos(s1.theta1);
    const x2 = x1 + l2 * Math.sin(s1.theta2);
    const y2 = y1 + l2 * Math.cos(s1.theta2);

    const dist1 = Math.sqrt((mx - x1) ** 2 + (my - y1) ** 2);
    const dist2 = Math.sqrt((mx - x2) ** 2 + (my - y2) ** 2);

    if (dist2 < 25) {
      isDragging.current = 'bob2';
    } else if (dist1 < 25) {
      isDragging.current = 'bob1';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pivotX = canvas.width / 2;
    const pivotY = canvas.height * 0.32;

    if (isDragging.current === 'bob1') {
      const angle = Math.atan2(mx - pivotX, my - pivotY);
      state1.current.theta1 = angle;
      state1.current.omega1 = 0;
      state2.current.theta1 = angle + 0.0001;
      state2.current.omega1 = 0;
      trail1.current = [];
      trail2.current = [];
    } else if (isDragging.current === 'bob2') {
      const s1 = state1.current;
      const x1 = pivotX + l1 * Math.sin(s1.theta1);
      const y1 = pivotY + l1 * Math.cos(s1.theta1);
      const angle = Math.atan2(mx - x1, my - y1);
      state1.current.theta2 = angle;
      state1.current.omega2 = 0;
      state2.current.theta2 = angle;
      state2.current.omega2 = 0;
      trail1.current = [];
      trail2.current = [];
    }
  };

  const handleMouseUp = () => {
    isDragging.current = null;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Pendulum Interactive Canvas & Phase Diagram */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-slate-950 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden min-h-[500px] flex flex-col sm:flex-row"
      >
        <div className="flex-1 relative h-full">
          <canvas
            ref={canvasRef}
            width={520}
            height={440}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-full block cursor-grab active:cursor-grabbing"
          />

          {/* Floating Energy & Butterfly divergence badge */}
          <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg flex items-center gap-3 font-mono">
            <div className="text-cyan-400">
              $E_k$: <strong className="text-white">{telemetry.kineticEnergy}</strong>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div className="text-amber-400">
              $E_p$: <strong className="text-white">{telemetry.potentialEnergy}</strong>
            </div>
            <div className="w-px h-3 bg-slate-700" />
            <div className="text-rose-400 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" />
              <span>나비 분기 거리: <strong className="text-white">{telemetry.divergence} px</strong></span>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 text-slate-400 text-xs bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-800/60">
            🖐️ 진자 끝 추(Bob)를 <strong>마우스로 잡고 끌어서</strong> 초기 각도를 설정하세요.
          </div>
        </div>

        {/* Right Phase Space Plot */}
        <div className="w-full sm:w-56 border-t sm:border-t-0 sm:border-l border-slate-800 bg-slate-950 flex flex-col">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-3 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <span>위상 공간 끌개</span>
            <span className="text-cyan-400 font-mono">Chaos Plot</span>
          </div>
          <canvas
            ref={phaseCanvasRef}
            width={200}
            height={200}
            className="w-full h-44 sm:h-52 block"
          />

          <div className="p-3 text-[11px] text-slate-400 space-y-2 border-t border-slate-800/80 bg-slate-900/40 mt-auto">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>결정론적 혼돈 (Deterministic Chaos)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              두 진자는 단 0.0001 rad(0.005도)의 미세한 차이로 시작했지만, 비선형 결합으로 인해 일정 시간 후 궤적이 완전히 갈라집니다 (나비 효과).
            </p>
          </div>
        </div>
      </div>

      {/* Side Control Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-3.5 bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80 text-sm overflow-y-auto">
        <div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            진자 물리 파라미터 조절
          </label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>진자 1 길이 ($L_1$)</span>
                <span className="font-mono text-cyan-400">{l1} px</span>
              </div>
              <input
                type="range"
                min="60"
                max="200"
                step="5"
                value={l1}
                onChange={(e) => setL1(parseInt(e.target.value))}
                aria-label="진자 1 길이"
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>진자 2 길이 ($L_2$)</span>
                <span className="font-mono text-cyan-400">{l2} px</span>
              </div>
              <input
                type="range"
                min="60"
                max="200"
                step="5"
                value={l2}
                onChange={(e) => setL2(parseInt(e.target.value))}
                aria-label="진자 2 길이"
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>진자 1 질량 ($m_1$)</span>
                <span className="font-mono text-amber-400">{m1} kg</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={m1}
                onChange={(e) => setM1(parseInt(e.target.value))}
                aria-label="진자 1 질량"
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>진자 2 질량 ($m_2$)</span>
                <span className="font-mono text-amber-400">{m2} kg</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={m2}
                onChange={(e) => setM2(parseInt(e.target.value))}
                aria-label="진자 2 질량"
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>공기 저항 감쇠 ($\gamma$)</span>
                <span className="font-mono text-cyan-400">{(damping * 1000).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.005"
                step="0.0002"
                value={damping}
                onChange={(e) => setDamping(parseFloat(e.target.value))}
                aria-label="공기 저항 감쇠"
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Toggles */}
        <div className="space-y-2">
          <button
            onClick={() => setShowTwin(!showTwin)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
              showTwin ? 'bg-rose-950/60 border-rose-500/50 text-rose-300' : 'bg-slate-800/40 border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-rose-400" />
              <span>나비효과 쌍둥이 진자 비교</span>
            </div>
            <span className="font-mono text-[11px]">{showTwin ? 'ON (Δθ = 10⁻⁴)' : 'OFF'}</span>
          </button>
        </div>

        <div className="mt-auto pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => resetPendulum(Math.PI * 0.9, Math.PI * 0.9)}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300 font-medium"
            >
              대각도 카오스
            </button>
            <button
              onClick={() => resetPendulum(0.2, 0.2)}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300 font-medium"
            >
              미소각도 조화진동
            </button>
          </div>

          <button
            onClick={() => resetPendulum()}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>진자 위치 초기화</span>
          </button>
        </div>
      </div>
    </div>
  );
};
