import React, { useState } from 'react';
import { LabTopic } from '../types';
import { 
  Bot, 
  X, 
  Sparkles, 
  Send, 
  HelpCircle, 
  Target, 
  BookOpen, 
  RefreshCw,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { playBlip } from '../utils/audioSynth';

interface AiMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: LabTopic;
}

const TOPIC_SUGGESTIONS: Record<LabTopic, string[]> = {
  gravity: [
    "태양계 행성들이 왜 태양으로 떨어지지 않고 안정적인 공전을 유지하나요?",
    "라그랑주 점(Lagrange Points)은 무엇이고 우주 망원경이 왜 그곳에 머무나요?",
    "삼체 문제(Three-Body Problem)가 왜 수학적으로 일반해를 구할 수 없나요?"
  ],
  wave: [
    "영의 이중 슬릿 간섭 실험이 빛의 파동성을 어떻게 증명했나요?",
    "도플러 효과(Doppler Effect)와 적색 편이(Redshift)의 원리는 무엇인가요?",
    "회절(Diffraction) 현상이 파장이 길수록 더 뚜렷해지는 이유는 무엇인가요?"
  ],
  thermo: [
    "맥스웰-볼츠만 속도 분포가 온도와 분자량에 따라 왜 달라지나요?",
    "보일의 법칙과 샤를의 법칙을 분자 운동론 관점에서 설명해주세요.",
    "열역학 제2법칙과 엔트로피 증가의 의미를 쉽게 알려주세요."
  ],
  pendulum: [
    "이중 진자에서 결정론적 혼돈(Deterministic Chaos)과 나비 효과란 무엇인가요?",
    "미소 진동과 대각도 진동의 운동 방정식 차이는 무엇인가요?",
    "위상 공간(Phase Space) 다이어그램이 카오스 분석에 왜 유용한가요?"
  ],
  lorentz: [
    "사이클로트론 가속기에서 회전 주기가 입자 속도와 무관한 이유는 무엇인가요?",
    "속도 선택기(Velocity Selector)에서 E와 B의 직교 조건 원리는 무엇인가요?",
    "지구 자기장과 오로라가 발생하는 원리를 로렌츠 힘과 연계해 설명해주세요."
  ],
  projectile: [
    "진공에서 45도가 최대 사거리인 이유와 공기 저항이 있을 때 각도가 낮아지는 이유는?",
    "질량이 다른 두 물체의 포물선 운동에서 공기 저항 영향 차이는?",
    "탄도 궤적 계산에서 종단 속도(Terminal Velocity)의 정의는 무엇인가요?"
  ]
};

export const AiMentorModal: React.FC<AiMentorModalProps> = ({ isOpen, onClose, topic }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; mode?: string }[]>([
    {
      role: 'assistant',
      text: `안녕하세요! AI 과학 랩 멘토입니다. 현재 **${
        topic === 'gravity' ? '천체 중력 N-바디' :
        topic === 'wave' ? '파동 간섭 & 슬릿' :
        topic === 'thermo' ? '기체 분자 운동론' :
        topic === 'pendulum' ? '카오스 이중 진자' :
        topic === 'lorentz' ? '전자기장 로렌츠 힘' : '포물선 탄도학'
      }** 실험실에 계십니다. 시뮬레이션 관련 물리 법칙, 수식 유도, 가상 실험 챌린지 등 무엇이든 질문하세요!`
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || loading) return;

    playBlip(600, 0.04);
    const userMsg = { role: 'user' as const, text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!customText) setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          userQuestion: textToSend
        })
      });

      const data = await res.json();
      if (data.explanation) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.explanation }]);
        playBlip(750, 0.05);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: '설명을 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: '서버와 통신할 수 없습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleGetChallenge = async () => {
    if (loading) return;
    playBlip(680, 0.05);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', text: '🎯 이 실험실에서 도전해볼 수 있는 과학 실험 미션을 추천해줘!' }]);

    try {
      const res = await fetch('/api/gemini/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level: 'intermediate' })
      });
      const data = await res.json();
      if (data.challenge) {
        const text = `🎯 **[실험 챌린지 퀘스트] ${data.challenge.title}**\n\n📌 **목표**: ${data.challenge.goal}\n\n⚙️ **가이드라인**:\n${data.challenge.steps.map((s: string, i: number) => `${i+1}. ${s}`).join('\n')}\n\n💡 **핵심 물리 힌트**: ${data.challenge.physicsHint}`;
        setMessages(prev => [...prev, { role: 'assistant', text }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: '챌린지를 불러오지 못했습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#080808] border border-[#262626] rounded-sm w-full max-w-2xl max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] bg-[#0A0A0A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-sm bg-[#141414] border border-[#333] text-[#00D1FF]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-wide flex items-center gap-2 font-mono">
                GEMINI AI SCIENCE TUTOR
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">실시간 물리 이론 해설 & 실험 미션 가이드</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGetChallenge}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1A1A1A] hover:bg-[#252525] border border-amber-500/40 text-amber-300 text-xs font-mono font-bold transition-all"
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>실험 챌린지 생성</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-sm text-neutral-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat History Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm bg-[#050505]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-sm bg-[#141414] border border-[#333] flex items-center justify-center text-[#00D1FF] shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-sm px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-[#00D1FF] text-black font-semibold shadow-md'
                    : 'bg-[#121212] text-neutral-200 border border-[#262626] font-mono'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-[#00D1FF] font-mono">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>GEMINI AI ENGINE COMPUTING...</span>
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        <div className="px-5 py-2.5 border-t border-[#1F1F1F] bg-[#0A0A0A] overflow-x-auto flex gap-2 no-scrollbar">
          {TOPIC_SUGGESTIONS[topic]?.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSend(sug)}
              className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-sm bg-[#141414] hover:bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A] hover:border-[#00D1FF]/50 transition-colors"
            >
              💡 {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#222] bg-[#0A0A0A] flex gap-2 font-mono">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="물리 현상, 공식, 실험 조건에 대해 무엇이든 질문하세요..."
            className="flex-1 bg-[#050505] border border-[#333] rounded-sm px-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!query.trim() || loading}
            className="px-4 py-2 rounded-sm bg-[#00D1FF] hover:bg-[#00bfe6] disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_8px_rgba(0,209,255,0.4)]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>전송</span>
          </button>
        </div>
      </div>
    </div>
  );
};
