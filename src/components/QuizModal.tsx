import React, { useState, useEffect } from 'react';
import { LabTopic, QuizItem } from '../types';
import { 
  HelpCircle, 
  X, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  RefreshCw, 
  Trophy, 
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playBlip, playTargetHit } from '../utils/audioSynth';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: LabTopic;
}

export const QuizModal: React.FC<QuizModalProps> = ({ isOpen, onClose, topic }) => {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);

  const fetchQuizzes = async () => {
    setLoading(true);
    setQuizzes([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setCompleted(false);

    try {
      const res = await fetch('/api/gemini/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: 3 })
      });
      const data = await res.json();
      if (data.quizzes && data.quizzes.length > 0) {
        setQuizzes(data.quizzes);
      }
    } catch (e) {
      console.error('Quiz fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuizzes();
    }
  }, [isOpen, topic]);

  if (!isOpen) return null;

  const currentQuiz = quizzes[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedAnswer(idx);
    setIsAnswered(true);

    const isCorrect = idx === currentQuiz.correctAnswerIndex;
    if (isCorrect) {
      playTargetHit();
      setScore(s => s + 1);
    } else {
      playBlip(280, 0.1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < quizzes.length) {
      setCurrentIndex(c => c + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      playBlip(550, 0.05);
    } else {
      setCompleted(true);
      if (score + (selectedAnswer === currentQuiz.correctAnswerIndex ? 1 : 0) === quizzes.length) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#080808] border border-[#262626] rounded-sm w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] bg-[#0A0A0A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-sm bg-[#141414] border border-[#333] text-purple-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-wide font-mono">
                AI SCIENCE CONCEPT QUIZ
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">실험을 통해 배운 물리학 원리를 검증해보세요</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-neutral-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 bg-[#050505]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3 text-[#00D1FF] font-mono">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="text-xs font-semibold">GEMINI AI GENERATING QUIZ QUESTIONS...</p>
            </div>
          ) : completed ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 font-mono">
              <div className="w-16 h-16 rounded-sm bg-[#141414] border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white uppercase tracking-wider">QUIZ COMPLETED!</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  총 <strong className="text-[#00D1FF]">{quizzes.length}</strong>문제 중 <strong className="text-amber-400">{score}</strong>문제를 맞추셨습니다!
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={fetchQuizzes}
                  className="px-4 py-2 rounded-sm bg-[#141414] hover:bg-[#202020] text-neutral-200 text-xs font-bold flex items-center gap-1.5 border border-[#333]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 풀기</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-sm bg-[#00D1FF] hover:bg-[#00bfe6] text-black text-xs font-bold shadow-[0_0_8px_rgba(0,209,255,0.4)]"
                >
                  확인 완료
                </button>
              </div>
            </div>
          ) : currentQuiz ? (
            <div className="space-y-4">
              {/* Progress & Question */}
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-1">
                <span>QUESTION {currentIndex + 1} / {quizzes.length}</span>
                <span className="text-[#00D1FF] font-bold">SCORE: {score}</span>
              </div>

              <h4 className="text-xs font-medium text-white leading-relaxed">
                {currentQuiz.question}
              </h4>

              {/* Options */}
              <div className="space-y-2 pt-2">
                {currentQuiz.options.map((opt, idx) => {
                  let btnStyle = 'bg-[#121212] hover:bg-[#1C1C1C] text-neutral-200 border-[#262626]';
                  if (isAnswered) {
                    if (idx === currentQuiz.correctAnswerIndex) {
                      btnStyle = 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200';
                    } else if (idx === selectedAnswer) {
                      btnStyle = 'bg-rose-950/40 border-rose-500/80 text-rose-200';
                    } else {
                      btnStyle = 'bg-[#0A0A0A] border-[#1C1C1C] text-neutral-600 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full text-left p-3 rounded-sm border text-xs font-medium transition-all flex items-center justify-between ${btnStyle}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-sm bg-[#1C1C1C] border border-[#333] flex items-center justify-center text-[10px] font-mono shrink-0">
                          {idx + 1}
                        </span>
                        <span>{opt}</span>
                      </div>

                      {isAnswered && idx === currentQuiz.correctAnswerIndex && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {isAnswered && idx === selectedAnswer && idx !== currentQuiz.correctAnswerIndex && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Reveal */}
              {isAnswered && (
                <div className="p-3 bg-[#121212] rounded-sm border border-[#2A2A2A] text-xs space-y-1.5 animate-fade-in font-mono">
                  <div className="font-bold text-[#00D1FF] flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>정답 해설</span>
                  </div>
                  <p className="text-neutral-300 leading-relaxed font-sans">{currentQuiz.explanation}</p>
                </div>
              )}

              {/* Next Button */}
              {isAnswered && (
                <div className="pt-2 flex justify-end font-mono">
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 rounded-sm bg-[#00D1FF] hover:bg-[#00bfe6] text-black text-xs font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,209,255,0.4)]"
                  >
                    <span>{currentIndex + 1 < quizzes.length ? 'NEXT QUESTION' : 'VIEW RESULTS'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-mono text-neutral-500">
              문제를 불러오지 못했습니다. 다시 시도해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
