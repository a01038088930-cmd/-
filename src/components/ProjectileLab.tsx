import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ProjectileRecord } from '../types';
import { 
  Target, 
  RotateCcw, 
  Sparkles, 
  Wind, 
  Layers, 
  Sliders, 
  Flame, 
  Globe, 
  Compass,
  Trophy,
  History
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playCannonLaunch, playTargetHit, playBlip } from '../utils/audioSynth';

interface ProjectileLabProps {
  isRunning: boolean;
  timeScale: number;
}

const PLANETS = [
  { name: '지구 (Earth)', g: 9.81, color: '#38bdf8' },
  { name: '달 (Moon)', g: 1.62, color: '#94a3b8' },
  { name: '화성 (Mars)', g: 3.71, color: '#f87171' },
  { name: '목성 (Jupiter)', g: 24.79, color: '#fb923c' },
];

export const ProjectileLab: React.FC<ProjectileLabProps> = ({ isRunning, timeScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cannon Parameters
  const [angle, setAngle] = useState<number>(45); // degrees
  const [velocity, setVelocity] = useState<number>(40); // m/s
  const [cannonHeight, setCannonHeight] = useState<number>(10); // meters
  const [projectileMass, setProjectileMass] = useState<number>(5.0); // kg
  const [dragCoeff, setDragCoeff] = useState<number>(0.2); // 0 (vacuum) to 1.0
  const [windSpeed, setWindSpeed] = useState<number>(0.0); // -15 to +15 m/s
  const [planetIndex, setPlanetIndex] = useState<number>(0);
  const [targetDistance, setTargetDistance] = useState<number>(150); // meters
  const [targetSize, setTargetSize] = useState<number>(10); // meters

  // Trajectories & Active Simulation Ball
  const [trajectories, setTrajectories] = useState<ProjectileRecord[]>([]);
  const [activeBall, setActiveBall] = useState<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    t: number;
    maxH: number;
    pts: { x: number; y: number }[];
  } | null>(null);

  const activeBallRef = useRef(activeBall);
  activeBallRef.current = activeBall;

  const [hitScore, setHitScore] = useState<number>(0);
  const [hitMessage, setHitMessage] = useState<string | null>(null);

  const g = PLANETS[planetIndex].g;

  // Fire Cannon
  const fireCannon = useCallback(() => {
    playCannonLaunch();

    const rad = (angle * Math.PI) / 180;
    const v0x = velocity * Math.cos(rad);
    const v0y = velocity * Math.sin(rad);

    setActiveBall({
      x: 0,
      y: cannonHeight,
      vx: v0x,
      vy: v0y,
      t: 0,
      maxH: cannonHeight,
      pts: [{ x: 0, y: cannonHeight }]
    });

    setHitMessage(null);
  }, [angle, velocity, cannonHeight]);

  // Main Canvas & Ballistics Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Coordinate Scaling (Meters to Canvas Pixels)
      const scale = Math.min(w / 240, (h - 90) / 120);
      const groundY = h - 60;
      const originX = 50;

      const toCanvasX = (mX: number) => originX + mX * scale;
      const toCanvasY = (mY: number) => groundY - mY * scale;

      // 1. Sky & Ground Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Distant Grid Lines
      ctx.strokeStyle = '#1e293b40';
      ctx.lineWidth = 1;
      for (let mx = 0; mx <= 300; mx += 25) {
        const cx = toCanvasX(mx);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, groundY);
        ctx.stroke();

        // Distance meter marks
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(`${mx}m`, cx - 10, groundY + 16);
      }

      for (let my = 0; my <= 120; my += 20) {
        const cy = toCanvasY(my);
        ctx.beginPath();
        ctx.moveTo(originX, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();

        // Height meter marks
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(`${my}m`, originX - 35, cy + 3);
      }

      // Ground Surface
      const gradGround = ctx.createLinearGradient(0, groundY, 0, h);
      gradGround.addColorStop(0, '#1e293b');
      gradGround.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradGround;
      ctx.fillRect(0, groundY, w, h - groundY);

      ctx.strokeStyle = '#38bdf840';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      // 2. Render Target Zone
      const targetCanvasX = toCanvasX(targetDistance);
      const targetCanvasW = targetSize * scale;

      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.fillRect(targetCanvasX - targetCanvasW / 2, groundY - 4, targetCanvasW, 8);

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(targetCanvasX - targetCanvasW / 2, groundY - 4, targetCanvasW, 8);

      // Target Flag
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(targetCanvasX, groundY);
      ctx.lineTo(targetCanvasX, groundY - 24);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(targetCanvasX, groundY - 24);
      ctx.lineTo(targetCanvasX + 14, groundY - 18);
      ctx.lineTo(targetCanvasX, groundY - 12);
      ctx.fill();

      // 3. Render Past Trajectories
      const colors = ['#0ea5e9', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
      for (let i = 0; i < trajectories.length; i++) {
        const traj = trajectories[i];
        if (traj.points.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = traj.color;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);

          for (let pIdx = 0; pIdx < traj.points.length; pIdx++) {
            const pt = traj.points[pIdx];
            const cx = toCanvasX(pt.x);
            const cy = toCanvasY(pt.y);
            if (pIdx === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Apex vertex marker
          const apexPt = traj.points.reduce((max, p) => p.y > max.y ? p : max, traj.points[0]);
          if (apexPt) {
            ctx.fillStyle = traj.color;
            ctx.beginPath();
            ctx.arc(toCanvasX(apexPt.x), toCanvasY(apexPt.y), 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 4. Update Active Ball
      const ball = activeBallRef.current;
      if (ball && isRunning) {
        const dt = 0.03 * timeScale;
        const subSteps = 5;
        const subDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
          // Relative air velocity considering wind
          const relVx = ball.vx - windSpeed;
          const relVy = ball.vy;
          const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

          // Drag Force: F_d = 0.5 * rho * Cd * A * v^2
          const dragMagnitude = 0.5 * 1.2 * dragCoeff * 0.05 * relSpeed * relSpeed;
          const fDragX = relSpeed > 0 ? -dragMagnitude * (relVx / relSpeed) : 0;
          const fDragY = relSpeed > 0 ? -dragMagnitude * (relVy / relSpeed) : 0;

          // Accelerations
          const ax = fDragX / projectileMass;
          const ay = -g + (fDragY / projectileMass);

          ball.vx += ax * subDt;
          ball.vy += ay * subDt;

          ball.x += ball.vx * subDt;
          ball.y += ball.vy * subDt;
          ball.t += subDt;

          if (ball.y > ball.maxH) {
            ball.maxH = ball.y;
          }

          ball.pts.push({ x: ball.x, y: ball.y });

          // Ground Impact Check
          if (ball.y <= 0) {
            ball.y = 0;
            const finalRange = ball.x;
            const finalTime = ball.t;
            const isHit = Math.abs(finalRange - targetDistance) <= targetSize / 2;

            if (isHit) {
              playTargetHit();
              setHitScore(sc => sc + 1);
              setHitMessage(`🎯 과녁 명중! 비거리: ${finalRange.toFixed(1)}m, 비행시간: ${finalTime.toFixed(1)}s`);
              confetti({
                particleCount: 60,
                spread: 70,
                origin: { y: 0.7 }
              });
            } else {
              setHitMessage(`착지 완료. 비거리: ${finalRange.toFixed(1)}m (과녁 오차: ${(finalRange - targetDistance).toFixed(1)}m)`);
            }

            // Save trajectory
            setTrajectories(prev => [
              ...prev.slice(-6),
              {
                id: `traj-${Date.now()}`,
                angle,
                velocity,
                mass: projectileMass,
                dragCoeff,
                gravity: g,
                points: ball.pts.map(p => ({ ...p, t: 0 })),
                color: isHit ? '#f43f5e' : colors[prev.length % colors.length],
                maxHeight: parseFloat(ball.maxH.toFixed(1)),
                range: parseFloat(finalRange.toFixed(1)),
                flightTime: parseFloat(finalTime.toFixed(1)),
                hitTarget: isHit
              }
            ]);

            setActiveBall(null);
            break;
          }
        }
      }

      // Render Active Ball Trajectory & Sphere
      if (ball) {
        // Active line
        if (ball.pts.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          for (let i = 0; i < ball.pts.length; i++) {
            const pt = ball.pts[i];
            const cx = toCanvasX(pt.x);
            const cy = toCanvasY(pt.y);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }

        // Ball Sphere
        const bX = toCanvasX(ball.x);
        const bY = toCanvasY(ball.y);

        ctx.beginPath();
        ctx.arc(bX, bY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Real-time Velocity vector arrow
        const vLen = 1.2;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bX, bY);
        ctx.lineTo(bX + ball.vx * vLen, bY - ball.vy * vLen);
        ctx.stroke();
      }

      // 5. Render Cannon at Launch Origin
      const cannonBaseX = toCanvasX(0);
      const cannonBaseY = toCanvasY(cannonHeight);

      // Cannon Stand
      if (cannonHeight > 0) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(cannonBaseX - 4, cannonBaseY, 8, groundY - cannonBaseY);
      }

      // Cannon Barrel
      const rad = (angle * Math.PI) / 180;
      const barrelLen = 28;
      const barrelEndX = cannonBaseX + Math.cos(rad) * barrelLen;
      const barrelEndY = cannonBaseY - Math.sin(rad) * barrelLen;

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cannonBaseX, cannonBaseY);
      ctx.lineTo(barrelEndX, barrelEndY);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Cannon Wheel Base
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(cannonBaseX, cannonBaseY, 8, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, timeScale, angle, velocity, cannonHeight, projectileMass, dragCoeff, windSpeed, g, targetDistance, targetSize, trajectories]);

  // Theoretical Calculations
  const rad = (angle * Math.PI) / 180;
  const theoreticalRange = (velocity * velocity * Math.sin(2 * rad)) / g;
  const theoreticalMaxH = cannonHeight + (velocity * Math.sin(rad)) ** 2 / (2 * g);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Simulation Ballistics Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative bg-slate-950 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden min-h-[500px] flex flex-col"
      >
        <canvas
          ref={canvasRef}
          width={680}
          height={460}
          className="w-full h-full block"
        />

        {/* Floating Telemetry & Formula Info */}
        <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-lg flex flex-wrap items-center gap-3 font-mono">
          <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>이론상 사거리 (진공): <strong className="text-white">{theoreticalRange.toFixed(1)} m</strong></span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="text-amber-400">
            최고점 높이: <strong className="text-white">{theoreticalMaxH.toFixed(1)} m</strong>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="text-rose-400 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>명중 횟수: <strong className="text-white">{hitScore}</strong></span>
          </div>
        </div>

        {/* Hit Result Banner */}
        {hitMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/40 text-xs shadow-xl flex items-center gap-2 font-medium text-cyan-200">
            <span>{hitMessage}</span>
          </div>
        )}

        {/* Canvas Bottom Quick Launch Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none text-slate-400 text-xs z-10">
          <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-800/60">
            🎯 과녁 거리: <strong>{targetDistance}m</strong> | 현재 행성: <strong>{PLANETS[planetIndex].name}</strong>
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => setTrajectories([])}
              className="bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              궤적 지우기
            </button>
          </div>
        </div>
      </div>

      {/* Side Controls Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-3.5 bg-slate-900/70 p-4 rounded-2xl border border-slate-800/80 text-sm overflow-y-auto">
        {/* Planet Gravity Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            천체 중력장 선택 ($g$)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {PLANETS.map((planet, idx) => (
              <button
                key={planet.name}
                onClick={() => {
                  playBlip(520, 0.05);
                  setPlanetIndex(idx);
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                  planetIndex === idx
                    ? 'bg-slate-700 border-cyan-400 text-white shadow font-semibold'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>{planet.name.split(' ')[0]}</div>
                <div className="text-[10px] text-slate-400">{planet.g} m/s²</div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Cannon Angle & Velocity Sliders */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            발사각 및 포구 속도
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>발사 각도 ($\theta$)</span>
              <span className="font-mono text-cyan-400">{angle}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={angle}
              onChange={(e) => setAngle(parseInt(e.target.value))}
              aria-label="발사 각도"
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>초기 발사 속도 ($v_0$)</span>
              <span className="font-mono text-cyan-400">{velocity} m/s</span>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="1"
              value={velocity}
              onChange={(e) => setVelocity(parseInt(e.target.value))}
              aria-label="초기 발사 속도"
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>발사대 초기 높이 ($h_0$)</span>
              <span className="font-mono text-amber-400">{cannonHeight} m</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="2"
              value={cannonHeight}
              onChange={(e) => setCannonHeight(parseInt(e.target.value))}
              aria-label="발사대 초기 높이"
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Aerodynamics & Wind */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-emerald-400" />
            공기 저항 및 바람
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>공기 저항 계수 ($C_d$)</span>
              <span className="font-mono text-emerald-400">{dragCoeff.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={dragCoeff}
              onChange={(e) => setDragCoeff(parseFloat(e.target.value))}
              aria-label="공기 저항 계수"
              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>바람 풍속 (Wind)</span>
              <span className="font-mono text-emerald-400">{windSpeed > 0 ? `+${windSpeed} m/s (순풍)` : windSpeed < 0 ? `${windSpeed} m/s (역풍)` : '0 m/s'}</span>
            </div>
            <input
              type="range"
              min="-15"
              max="15"
              step="1"
              value={windSpeed}
              onChange={(e) => setWindSpeed(parseInt(e.target.value))}
              aria-label="바람 풍속"
              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>과녁 목표 거리</span>
              <span className="font-mono text-rose-400">{targetDistance} m</span>
            </div>
            <input
              type="range"
              min="40"
              max="220"
              step="5"
              value={targetDistance}
              onChange={(e) => setTargetDistance(parseInt(e.target.value))}
              aria-label="과녁 목표 거리"
              className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={fireCannon}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all active:scale-98"
          >
            <Target className="w-4 h-4" />
            <span>포탄 발사 (FIRE!)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
