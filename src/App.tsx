import React, { useState, useEffect, useCallback } from 'react';
import { LabTopic } from './types';
import { Header } from './components/Header';
import { GravityLab } from './components/GravityLab';
import { WaveLab } from './components/WaveLab';
import { ThermoLab } from './components/ThermoLab';
import { PendulumLab } from './components/PendulumLab';
import { LorentzLab } from './components/LorentzLab';
import { ProjectileLab } from './components/ProjectileLab';
import { AiMentorModal } from './components/AiMentorModal';
import { QuizModal } from './components/QuizModal';
import { 
  Orbit, 
  Waves, 
  Flame, 
  Activity, 
  Zap, 
  Target, 
  Info,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { playBlip } from './utils/audioSynth';

export const App: React.FC = () => {
  const [activeTopic, setActiveTopic] = useState<LabTopic>('gravity');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);

  // Keyboard Shortcuts: Space (Play/Pause), 1-6 (Switch Lab)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsRunning(r => !r);
        playBlip(440, 0.05);
      } else if (e.key === '1') {
        setActiveTopic('gravity');
        playBlip(500, 0.04);
      } else if (e.key === '2') {
        setActiveTopic('wave');
        playBlip(550, 0.04);
      } else if (e.key === '3') {
        setActiveTopic('thermo');
        playBlip(600, 0.04);
      } else if (e.key === '4') {
        setActiveTopic('pendulum');
        playBlip(650, 0.04);
      } else if (e.key === '5') {
        setActiveTopic('lorentz');
        playBlip(700, 0.04);
      } else if (e.key === '6') {
        setActiveTopic('projectile');
        playBlip(750, 0.04);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleReset = useCallback(() => {
    playBlip(380, 0.06);
    // Reload state or trigger event
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#D1D1D1] flex flex-col font-sans selection:bg-[#00D1FF]/30 selection:text-[#00D1FF] bg-dot-grid">
      {/* Top Main Navigation Header */}
      <Header
        activeTopic={activeTopic}
        onSelectTopic={(topic) => {
          playBlip(520, 0.04);
          setActiveTopic(topic);
        }}
        isRunning={isRunning}
        onToggleRunning={() => {
          playBlip(isRunning ? 380 : 620, 0.05);
          setIsRunning(!isRunning);
        }}
        onReset={handleReset}
        timeScale={timeScale}
        onChangeTimeScale={(ts) => setTimeScale(ts)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        onOpenAI={() => {
          playBlip(700, 0.05);
          setIsAiModalOpen(true);
        }}
        onOpenFormulas={() => {
          playBlip(680, 0.05);
          setIsQuizModalOpen(true);
        }}
      />

      {/* Main Simulation Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 flex flex-col">
        <div className="flex-1 flex flex-col">
          {activeTopic === 'gravity' && (
            <GravityLab isRunning={isRunning} timeScale={timeScale} />
          )}

          {activeTopic === 'wave' && (
            <WaveLab isRunning={isRunning} timeScale={timeScale} />
          )}

          {activeTopic === 'thermo' && (
            <ThermoLab isRunning={isRunning} timeScale={timeScale} />
          )}

          {activeTopic === 'pendulum' && (
            <PendulumLab isRunning={isRunning} timeScale={timeScale} />
          )}

          {activeTopic === 'lorentz' && (
            <LorentzLab isRunning={isRunning} timeScale={timeScale} />
          )}

          {activeTopic === 'projectile' && (
            <ProjectileLab isRunning={isRunning} timeScale={timeScale} />
          )}
        </div>
      </main>

      {/* Footer Telemetry & Status Bar */}
      <footer className="border-t border-[#222] bg-[#0A0A0A] px-6 py-2.5 text-[11px] font-mono text-neutral-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-[#00D1FF] shadow-[0_0_8px_rgba(0,209,255,0.8)] animate-pulse" />
            <span className="text-white font-bold">SOLVER:</span> 60 FPS ACTIVE
          </span>
          <span className="text-[#333]">|</span>
          <span className="hidden sm:inline text-neutral-500">
            HOTKEYS: <span className="text-[#00D1FF]">[Space]</span> PLAY/PAUSE, <span className="text-[#00D1FF]">[1-6]</span> LAB SWITCH
          </span>
        </div>

        <div className="flex items-center gap-4 text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-neutral-600">ENGINE:</span>
            <span className="text-[#00D1FF]">Verlet / RK4 / FDTD</span>
          </div>
          <span className="text-[#333]">|</span>
          <button
            onClick={() => setIsQuizModalOpen(true)}
            className="hover:text-white text-[#00D1FF] underline transition-colors cursor-pointer"
          >
            개념 퀴즈 풀기
          </button>
        </div>
      </footer>

      {/* AI Modals */}
      <AiMentorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        topic={activeTopic}
      />

      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        topic={activeTopic}
      />
    </div>
  );
};

export default App;
