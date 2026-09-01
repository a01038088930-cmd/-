export type LabTopic = 
  | 'gravity' 
  | 'wave' 
  | 'thermo' 
  | 'pendulum' 
  | 'lorentz' 
  | 'projectile';

export interface CelestialBody {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  fixed?: boolean;
  trail: { x: number; y: number }[];
}

export interface GasParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  color: string;
}

export interface LorentzParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  q: number; // charge
  m: number; // mass
  color: string;
  trail: { x: number; y: number }[];
}

export interface ProjectileRecord {
  id: string;
  angle: number;
  velocity: number;
  mass: number;
  dragCoeff: number;
  gravity: number;
  points: { x: number; y: number; t: number }[];
  color: string;
  maxHeight: number;
  range: number;
  flightTime: number;
  hitTarget?: boolean;
}

export interface QuizItem {
  id?: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export type AIQuizQuestion = QuizItem;

export interface AILabChallenge {
  id: string;
  title: string;
  hypothesis: string;
  targetCondition: string;
  hint: string;
  rewardFact: string;
}
