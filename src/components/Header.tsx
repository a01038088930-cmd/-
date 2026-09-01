import React from 'react';
import { LabTopic } from '../types';
import { 
  Orbit, 
  Waves, 
  Flame, 
  Activity, 
  Zap, 
  Target, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  BookOpen,
  FastForward,
  Gauge
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface HeaderProps {
  activeTopic: LabTopic;
  onSelectTopic: (topic: LabTopic) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  onReset: () => void;
  timeScale: number;
  onChangeTimeScale: (scale: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenAI: () => void;
  onOpenFormulas: () => void;
}

const LAB_TABS: { id: LabTopic; title: string; icon: React.ComponentType<{ className?: string }>; badge: string; color: string }[] = [
  { id: 'gravity', title: '중력 & 천체 역학', icon: Orbit, badge: 'N-Body', color: 'from-amber-500 to-orange-600' },
  { id: 'wave', title: '파동 & 이중 슬릿', icon: Waves, badge: 'Optics', color: 'from-cyan-500 to-blue-600' },
  { id: 'thermo', title: '기체 운동 & 열역학', icon: Flame, badge: 'PV=nRT', color: 'from-rose-500 to-red-600' },
  { id: 'pendulum', title: '카오스 이중 진자', icon: Activity, badge: 'Chaos', color: 'from-emerald-500 to-teal-600' },
  { id: 'lorentz', title: '전자기장 & 로렌츠', icon: Zap, badge: 'E/B Field', color: 'from-violet-500 to-purple-600' },
  { id: 'projectile', title: '발사체 & 공기 저항', icon: Target, badge: 'Ballistics', color: 'from-blue-500 to-indigo-600' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTopic,
  onSelectTopic,
  isRunning,
  onToggleRunning,
  onReset,
  timeScale,
  onChangeTimeScale,
  isMuted,
  onToggleMute,
  onOpenAI,
  onOpenFormulas
}) => {
  return (
    <header className="border-b border-[#222] bg-[#0A0A0A] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Lab Title */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#00D1FF] flex items-center justify-center rounded-sm rotate-45 shadow-[0_0_10px_rgba(0,209,255,0.5)]">
              <div className="w-3.5 h-3.5 border-2 border-black rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white uppercase font-mono">
                  QUANTUM<span className="text-[#00D1FF]">LAB</span>
                </h1>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-sm bg-[#1A1A1A] border border-[#333] text-[#00D1FF] tracking-wider">
                  v4.0
                </span>
              </div>
              <p className="text-[10px] font-mono text-neutral-500 hidden sm:block">REAL-TIME INTERACTIVE PHYSICS SOLVER</p>
            </div>
          </div>

          {/* Telemetry quick indicators (Desktop & Mobile) */}
          <div className="hidden lg:flex items-center gap-6 border-l border-[#222] pl-6 ml-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase text-neutral-500 font-mono tracking-widest">Core Engine</span>
              <span className="text-xs font-mono text-[#00D1FF]">FDTD & RK4</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase text-neutral-500 font-mono tracking-widest">Stability</span>
              <span className="text-xs font-mono text-emerald-400">99.98%</span>
            </div>
          </div>

          {/* Mobile Right AI button */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              id="header-mobile-ai-btn"
              onClick={onOpenAI}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-[#00D1FF] text-black text-xs font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI 멘토</span>
            </button>
          </div>
        </div>

        {/* Lab Navigation Switcher */}
        <nav className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1 px-0.5 no-scrollbar">
          {LAB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTopic === tab.id;
            return (
              <button
                key={tab.id}
                id={`lab-tab-${tab.id}`}
                onClick={() => {
                  playBlip(520, 0.05);
                  onSelectTopic(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono transition-all duration-150 ${
                  isActive
                    ? 'bg-[#00D1FF] text-black font-bold border border-[#00D1FF] shadow-[0_0_10px_rgba(0,209,255,0.4)]'
                    : 'bg-[#1A1A1A] text-neutral-300 border border-[#333] hover:bg-[#252525] hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-[#00D1FF]'}`} />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </nav>

        {/* Global Simulation Playback Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Time scale selector */}
          <div className="flex items-center gap-1.5 bg-[#141414] px-2 py-1 rounded-sm border border-[#333] text-xs">
            <Gauge className="w-3.5 h-3.5 text-neutral-400" />
            <select
              id="time-scale-select"
              value={timeScale}
              onChange={(e) => onChangeTimeScale(parseFloat(e.target.value))}
              aria-label="시뮬레이션 재생 속도"
              className="bg-transparent text-neutral-200 font-mono text-[11px] outline-none cursor-pointer"
            >
              <option value="0.2" className="bg-[#141414]">0.2x SLOW</option>
              <option value="0.5" className="bg-[#141414]">0.5x</option>
              <option value="1.0" className="bg-[#141414]">1.0x STD</option>
              <option value="1.5" className="bg-[#141414]">1.5x</option>
              <option value="2.0" className="bg-[#141414]">2.0x FAST</option>
            </select>
          </div>

          {/* Play/Pause Button */}
          <button
            id="global-play-pause-btn"
            onClick={() => {
              playBlip(isRunning ? 320 : 640, 0.06);
              onToggleRunning();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono font-bold transition-all ${
              isRunning 
                ? 'bg-[#1A1A1A] text-amber-400 border border-amber-500/40 hover:bg-[#252525]' 
                : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-900/40'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>RUN</span>
              </>
            )}
          </button>

          {/* Reset Button */}
          <button
            id="global-reset-btn"
            onClick={() => {
              playBlip(380, 0.08);
              onReset();
            }}
            title="시뮬레이션 초기화"
            aria-label="시뮬레이션 초기화"
            className="p-1.5 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-[#333] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={onToggleMute}
            title={isMuted ? '음소거 해제' : '음소거'}
            aria-label={isMuted ? '음소거 해제' : '음소거'}
            className="p-1.5 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-[#333] transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#00D1FF]" />}
          </button>

          {/* Formulas Sheet Button */}
          <button
            id="formulas-modal-btn"
            onClick={onOpenFormulas}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 border border-[#333] text-xs font-mono transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#00D1FF]" />
            <span>원리 수식</span>
          </button>

          {/* AI Mentor Button */}
          <button
            id="header-ai-mentor-btn"
            onClick={onOpenAI}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] border border-[#00D1FF] text-[#00D1FF] hover:text-white text-xs font-mono font-bold shadow-[0_0_10px_rgba(0,209,255,0.25)] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00D1FF]" />
            <span>AI 멘토</span>
          </button>
        </div>
      </div>
    </header>
  );
};
