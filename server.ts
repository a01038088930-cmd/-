import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // AI Science Lab Explanation
  app.post("/api/gemini/explain", async (req, res) => {
    try {
      const { topic, parameters, question } = req.body;
      const ai = getAIClient();

      if (!ai) {
        // High quality fallback explanation when API key is not yet set
        return res.json({
          success: true,
          explanation: getFallbackExplanation(topic, parameters, question),
          source: "built-in-engine"
        });
      }

      const prompt = `당신은 세계 최고의 물리학/과학 교수이자 다정한 가상 실험실 AI 멘토입니다.
현재 사용자가 탐구 중인 시뮬레이션: ${topic}
현재 시뮬레이션 파라미터 상태: ${JSON.stringify(parameters || {})}
사용자 질문 또는 관찰: ${question || "이 시뮬레이션의 물리적 원리와 핵심 수식, 실제 세계에서의 응용 사례를 명쾌하고 흥미진진하게 설명해주세요."}

[작성 가이드]
1. 핵심 물리 법칙과 수식(LaTeX 표기 또는 깔끔한 수식 형태)을 직관적으로 설명하세요.
2. 현재 파라미터 상태(${JSON.stringify(parameters || {})})에서 어떤 현상이 일어나는지 짚어주세요.
3. 실생활이나 첨단 과학(우주 탐사, 반도체, 양자 컴퓨팅, 날씨 등)과의 연결점을 흥미롭게 제시하세요.
4. "직접 해볼 수 있는 추천 실험 조건" 2가지를 제안하세요.
5. 친절하고 신뢰감 넘치는 어조로 마크다운 형식으로 작성해주세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
      });

      res.json({
        success: true,
        explanation: response.text || "설명을 생성하지 못했습니다.",
        source: "gemini-3.7-flash"
      });
    } catch (error: any) {
      console.error("Gemini explain error:", error);
      res.json({
        success: true,
        explanation: getFallbackExplanation(req.body?.topic, req.body?.parameters, req.body?.question),
        source: "built-in-engine-fallback"
      });
    }
  });

  // AI Lab Challenge / Hypothesis Generator
  app.post("/api/gemini/challenge", async (req, res) => {
    try {
      const { topic, difficulty } = req.body;
      const ai = getAIClient();

      if (!ai) {
        return res.json({
          success: true,
          challenges: getFallbackChallenges(topic),
          source: "built-in-engine"
        });
      }

      const prompt = `시뮬레이션 주제: ${topic} (난이도: ${difficulty || '중급'})
사용자가 이 가상 실험실에서 직접 조작하며 과학적 가설을 검증할 수 있는 '탐구 챌린지 미션' 3개를 JSON 형식으로 만들어주세요.

반드시 다음 JSON 형식만 순수하게 출력하세요:
[
  {
    "id": "mission-1",
    "title": "미션 제목",
    "hypothesis": "검증할 가설",
    "targetCondition": "달성해야 하는 조건 (예: 궤도 이심률 < 0.05, 정상파 노드 4개 생성 등)",
    "hint": "조작 팁과 물리적 원리 힌트",
    "rewardFact": "성공 시 알게 되는 흥미로운 과학 팩트"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let parsed = [];
      try {
        parsed = JSON.parse(response.text || "[]");
      } catch {
        parsed = getFallbackChallenges(topic);
      }

      res.json({
        success: true,
        challenges: parsed,
        source: "gemini-3.7-flash"
      });
    } catch (error) {
      console.error("Gemini challenge error:", error);
      res.json({
        success: true,
        challenges: getFallbackChallenges(req.body?.topic),
        source: "built-in-engine"
      });
    }
  });

  // AI Quiz Generator
  app.post("/api/gemini/quiz", async (req, res) => {
    try {
      const { topic } = req.body;
      const ai = getAIClient();

      if (!ai) {
        return res.json({
          success: true,
          quizzes: getFallbackQuizzes(topic),
          source: "built-in-engine"
        });
      }

      const prompt = `과학 주제 '${topic}'에 관한 직관적이고 개념을 점검할 수 있는 4지선다형 퀴즈 3문제를 JSON 배열로 만들어주세요.

반드시 다음 JSON 형식만 출력하세요:
[
  {
    "id": 1,
    "question": "문제 내용",
    "options": ["보기 1", "보기 2", "보기 3", "보기 4"],
    "correctIndex": 0,
    "explanation": "정답 해설과 과학적 원리"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let parsed = [];
      try {
        parsed = JSON.parse(response.text || "[]");
      } catch {
        parsed = getFallbackQuizzes(topic);
      }

      res.json({
        success: true,
        quizzes: parsed,
        source: "gemini-3.7-flash"
      });
    } catch (error) {
      console.error("Gemini quiz error:", error);
      res.json({
        success: true,
        quizzes: getFallbackQuizzes(req.body?.topic),
        source: "built-in-engine"
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Science Simulation Server running on http://0.0.0.0:${PORT}`);
  });
}

function getFallbackExplanation(topic?: string, _params?: any, _question?: string): string {
  switch (topic) {
    case "gravity":
      return `### 🌌 만유인력과 N체 천체 궤도 역학 (Gravitational N-Body Dynamics)

**1. 핵심 원리 및 지배 수식**
뉴턴의 만유인력 법칙에 따라 질량 $m_1, m_2$를 가진 두 천체 사이에는 거리의 역제곱에 비례하는 인력이 작용합니다:
$$F = G \\frac{m_1 m_2}{r^2}$$
천체의 가속도는 $\\vec{a}_i = \\sum_{j \\neq i} G \\frac{m_j}{|\\vec{r}_j - \\vec{r}_i|^3}(\\vec{r}_j - \\vec{r}_i)$ 로 계산되며, 시뮬레이션에서는 시간 적분(Verlet/Euler-Cromer)으로 궤적을 갱신합니다.

**2. 삼체 문제(Three-body Problem)와 혼돈(Chaos)**
두 천체(2-Body)는 케플러 타원 궤도로 완벽하게 닫히지만, 3개 이상의 천체는 일반 해석해(Closed-form solution)가 존재하지 않는 카오스 시스템입니다. 미세한 초기 위치 차이가 행성의 방출이나 충돌로 이어집니다.

**3. 현실 속 응용**
- **인공위성의 라그랑주 점(Lagrange Points)** 활용 (제임스 웹 우주망원경 L2)
- 행성 간 탐사선의 **중력 도움(Gravity Assist / Slingshot)** 비행
- 블랙홀 주변 강착원반 및 은하 병합 시뮬레이션

💡 **추천 실험:**
1. 중심에 거대 항성(질량 1000)을 두고, 주위에 원궤도 속도 $v = \\sqrt{GM/r}$ 를 갖는 행성 3개를 배치해 공전 궤도 안정을 확인해보세요.
2. 비슷한 질량의 천체 3개를 정삼각형 꼭짓점에 두고 대칭 궤도 붕괴를 관찰해보세요.`;

    case "wave":
      return `### 🌊 파동의 간섭과 영의 이중 슬릿 (Wave Interference & Double-Slit)

**1. 핵심 원리 및 중첩 원리**
모든 파동은 매질 내에서 **중첩의 원리(Superposition Principle)**를 따릅니다.
두 파동 $\\psi_1, \\psi_2$가 만날 때 합성파는 $\\psi = \\psi_1 + \\psi_2$가 되며, 경로차($\\Delta L$)에 따라:
- **보강 간섭 (Bright Fringe):** $\\Delta L = d \\sin\\theta = m\\lambda \\quad (m = 0, \\pm 1, \\pm 2, \\dots)$
- **상쇄 간섭 (Dark Fringe):** $\\Delta L = (m + 1/2)\\lambda$

**2. 2D 파동 방정식 (Wave Equation)**
시뮬레이션 캔버스는 편미분 파동 방정식 $\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u$ 를 2차원 격자 유한차분법(FDTD)으로 실시간 적분하고 있습니다.

**3. 과학사적 의미와 양자역학**
1801년 토마스 영의 빛의 간섭 실험으로 빛의 파동성이 증명되었으며, 20세기에는 단일 전자/광자를 이용한 이중 슬릿 실험을 통해 입자-파동 이중성(Wave-Particle Duality)이라는 양자역학의 핵심 기초가 정립되었습니다.

💡 **추천 실험:**
1. 파장($\\lambda$)을 줄이거나 슬릿 간격($d$)을 넓혔을 때 검출기 스크린의 간섭 무늬 간격이 좁아지는 것을 확인하세요.
2. 단일 슬릿(회절)과 이중 슬릿(회절+간섭)의 세기 분포 차이를 비교해보세요.`;

    case "thermo":
      return `### 💨 이상 기체 상태 방정식과 분자 운동론 (Kinetic Theory of Gases)

**1. 거시적 상태 방정식과 미시적 운동**
- 거시적 법칙: $PV = nRT = N k_B T$
- 미시적 해석: 압력 $P$는 분자들이 용기 벽면에 충돌하며 가하는 단위 면적당 평균 충격량입니다:
$$P = \\frac{1}{3} \\frac{N}{V} m \\langle v^2 \\rangle$$

**2. 맥스웰-볼츠만 속도 분포 (Maxwell-Boltzmann Distribution)**
절대온도 $T$가 올라가면 기체 분자들의 평균 운동 에너지 $\\langle E_k \\rangle = \\frac{3}{2} k_B T$ 가 증가하며, 속도 분포 그래프가 우측으로 넓게 퍼집니다.

**3. 보일-샤를의 법칙**
- 온도가 일정할 때 부피를 절반으로 줄이면 충돌 빈도가 2배가 되어 압력이 2배 상승합니다 ($P \\propto 1/V$).
- 압력이 일정할 때 가열하면 팽창합니다 ($V \\propto T$).

💡 **추천 실험:**
1. 피스톤을 아래로 빠르게 눌러 단열 압축 시 분자들의 속도와 압력이 급상승하는 현상을 확인하세요.
2. 무거운 분자와 가벼운 분자를 동시에 주입하여 동일 온도에서 가벼운 분자의 평균 속도가 더 빠른 것을 확인하세요 ($v_{rms} = \\sqrt{3k_B T / M}$).`;

    case "pendulum":
      return `### 🌀 카오스 이중 진자 & 위상 공간 (Chaotic Double Pendulum)

**1. 라그랑주 역학 (Lagrangian Mechanics)**
단진자는 미소각도에서 단순 조화 진동자($\\theta(t) = \\theta_0 \\cos(\\omega t)$)이지만, 이중 진자는 두 각도 $\\theta_1, \\theta_2$가 고도로 비선형 결합된 결합 진동자입니다:
$$L = T - V = \\frac{1}{2}(m_1+m_2)l_1^2 \\dot{\\theta}_1^2 + \\frac{1}{2}m_2 l_2^2 \\dot{\\theta}_2^2 + m_2 l_1 l_2 \\dot{\\theta}_1 \\dot{\\theta}_2 \\cos(\\theta_1-\\theta_2) - V(\\theta_1,\\theta_2)$$

**2. 초기 조건 민감성 (나비 효과)**
초기 각도가 $0.001^\\circ$ 만 달라도 일정 시간 후 두 진자의 궤적은 완전히 다른 궤적을 그리게 됩니다. 이를 리아푸노프 지수(Lyapunov Exponent)로 정량화합니다.

**3. 결정론적 혼돈 (Deterministic Chaos)**
뉴턴 역학처럼 완벽히 결정론적인 법칙에 의해 움직이지만, 장기적 예측이 불가능한 시스템으로 기상 예측의 한계와 난류 해석의 핵심 모형입니다.

💡 **추천 실험:**
1. 미세 오차($\\Delta \\theta = 0.001\\text{ rad}$)를 가진 쌍둥이 진자를 동시 실행하여 궤적이 갈라지는 순간을 찾아보세요.
2. 위상 공간($\\theta$ vs $\\omega$) 그래프에서 기묘한 끌개(Strange Attractor) 패턴을 관찰해보세요.`;

    case "lorentz":
      return `### ⚡ 전자기장과 로렌츠 힘 (Lorentz Force & Particle Dynamics)

**1. 로렌츠 힘 법칙 (Lorentz Force)**
전하 $q$를 가진 입자가 전기장 $\\vec{E}$와 자기장 $\\vec{B}$ 속에서 속도 $\\vec{v}$로 운동할 때 받는 총 힘은:
$$\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})$$

**2. 사이클로트론 운동 (Cyclotron Motion)**
균일한 수직 자기장만 존재할 때, 자기력은 항상 속도에 수직이므로 일을 하지 않고 등속 원운동을 유도합니다:
- 회전 반경 (라모어 반경): $r = \\frac{m v}{q B}$
- 사이클로트론 주파수: $\\omega = \\frac{q B}{m}$ (속도와 무관!)

**3. 첨단 과학 응용**
- **입자 가속기 (CERN LHC):** 강력한 초전도 전자석으로 양성자를 빛의 속도 가깝게 휨
- **오로라와 밴 앨런대:** 지구 자기장에 갇힌 태양풍 하전 입자의 나선 운동
- **질량 분석기 (Mass Spectrometer):** 비전하($q/m$)에 따른 궤적 반경 차이로 동위원소 분리

💡 **추천 실험:**
1. 전기장과 자기장을 직교시켜 $\\vec{E} + \\vec{v}\\times\\vec{B} = 0$ 조건을 만족하는 '속도 선택기' ($v = E/B$)를 구현해보세요.
2. 전자($e^-$)와 양성자($p^+$)의 질량비(약 1836배)에 따른 궤적 곡률 차이를 비교해보세요.`;

    case "projectile":
    default:
      return `### 🎯 포물선 운동과 유체 항력 (Projectile Motion & Aerodynamics)

**1. 진공 상태에서의 2차원 등가속도 운동**
- 수평 방향: 등속 직선 운동 $x(t) = (v_0 \\cos\\theta) t$
- 수직 방향: 연직 상투 운동 $y(t) = (v_0 \\sin\\theta) t - \\frac{1}{2}gt^2$
- 최대 사거리 각도: 공기 저항이 없을 때 $45^\\circ$, 최대 도달 거리 $R = \\frac{v_0^2 \\sin(2\\theta)}{g}$

**2. 공기 저항(항력, Drag Force)**
현실에서는 공기 밀도 $\\rho$, 항력 계수 $C_d$, 단면적 $A$에 비례하는 공기 저항 $\\vec{F}_d = -\\frac{1}{2}\\rho C_d A |\\vec{v}| \\vec{v}$ 이 작용하여 궤적이 비대칭으로 변하고 최적 발사각이 $45^\\circ$보다 낮아집니다(약 $35^\\circ \\sim 42^\\circ$).

**3. 천체별 중력 비교**
- 달($g = 1.62\\text{ m/s}^2$): 지구의 6배 멀리 날아감
- 목성($g = 24.79\\text{ m/s}^2$): 지표면으로 급격히 낙하

💡 **추천 실험:**
1. 공기 저항을 0으로 둔 후 $30^\\circ$와 $60^\\circ$ 발사 시 도달 거리가 같음을 확인하세요.
2. 공기 저항을 최대로 높였을 때 종단 속도(Terminal Velocity)에 도달하여 수직 낙하하는 궤적을 확인하세요.`;
  }
}

function getFallbackChallenges(topic?: string) {
  switch (topic) {
    case "gravity":
      return [
        {
          id: "g1",
          title: "안정적인 원형 이체 궤도 만들기",
          hypothesis: "공전 속도 v가 정확히 sqrt(GM/r)일 때 이심률 0의 완벽한 원궤도를 형성할 것이다.",
          targetCondition: "행성이 항성 주위를 3바퀴 이상 궤도 이탈 없이 안정 회전",
          hint: "속도 벡터를 항성 방향과 정확히 90도 직교하게 설정하고 질량을 조절하세요.",
          rewardFact: "지구의 공전 궤도 이심률은 약 0.0167로 거의 완벽한 원에 가깝습니다!"
        },
        {
          id: "g2",
          title: "중력 새총 (Gravity Slingshot) 가속",
          hypothesis: "거대 행성의 중력장을 비스듬히 통과하면 탐사선의 속도가 급상승할 것이다.",
          targetCondition: "탐사선 최고 속도가 초기 속도의 1.8배 이상으로 증가",
          hint: "행성의 공전 진행 방향 뒤쪽으로 탐사선을 접근시켜 운동량을 흡수하세요.",
          rewardFact: "보이저 1호와 2호는 목성과 토성의 중력 도움으로 태양계 탈출 속도를 얻었습니다."
        },
        {
          id: "g3",
          title: "8자 형태 3체 대칭 궤도",
          hypothesis: "동일 질량의 천체 3개가 특정 위상으로 8자 경로를 번갈아 통과할 수 있다.",
          targetCondition: "3개 천체가 충돌 없이 8자 궤도를 10초 이상 유지",
          hint: "프리셋 'Moore 8자 궤도'를 로드하여 속도 균형을 관찰해보세요.",
          rewardFact: "1993년 크리스토퍼 무어가 발견한 기적적인 특수 3체 해입니다."
        }
      ];
    case "wave":
      return [
        {
          id: "w1",
          title: "중앙 제1 밝은 무늬 간격 측정",
          hypothesis: "슬릿 간격 d가 좁아질수록 스크린 상의 간섭 무늬 간격 Delta y는 넓어진다.",
          targetCondition: "슬릿 간격을 2배로 줄였을 때 간섭 무늬 피크 간격 2배 확대 확인",
          hint: "Delta y = (lambda * L) / d 공식을 검증해보세요.",
          rewardFact: "빛의 파장이 나노미터 단위라 슬릿이 극도로 좁아야 육안으로 무늬가 보입니다."
        },
        {
          id: "w2",
          title: "완벽한 상쇄 간섭 지점 탐색",
          hypothesis: "두 파원에서 나오는 파동의 위상이 반대(pi 차이)일 때 특정 축에서 진폭이 0이 된다.",
          targetCondition: "스크린 중심에서 진폭 0 (완전한 암전) 상태 달성",
          hint: "슬릿 한쪽의 위상을 180도 반전시키거나 파원 간격을 반파장의 홀수배로 맞추세요.",
          rewardFact: "노이즈 캔슬링 헤드폰이 바로 이 상쇄 간섭 원리로 외부 소음을 지웁니다!"
        }
      ];
    default:
      return [
        {
          id: "m1",
          title: "최적 발사각 찾기 (공기저항 유/무)",
          hypothesis: "진공에서는 45도가 최대 사거리이지만, 공기 저항이 증가하면 최적 각도가 40도 이하로 줄어든다.",
          targetCondition: "공기 저항 계수 0.5에서 최대 비거리 발사각 찾아 명중시키기",
          hint: "각도를 1도씩 바꾸며 궤적 비교 기능을 켜고 비거리를 측정하세요.",
          rewardFact: "야구의 타구 홈런 최적 각도도 공기 저항과 백스핀 양력 때문에 25~35도입니다."
        },
        {
          id: "m2",
          title: "다른 행성에서의 과녁 명중",
          hypothesis: "달의 중력(지구의 1/6)에서는 동일 발사 속도로 6배 먼 과녁을 맞출 수 있다.",
          targetCondition: "달 모드에서 500m 거리의 과녁 정확히 타격",
          hint: "중력 가속도 g를 1.62 m/s^2 로 설정하세요.",
          rewardFact: "아폴로 14호의 앨런 셰퍼드 우주비행사는 달에서 골프공을 쳐서 수백 미터를 날렸습니다."
        }
      ];
  }
}

function getFallbackQuizzes(topic?: string) {
  switch (topic) {
    case "gravity":
      return [
        {
          id: 1,
          question: "태양과 지구 사이의 거리가 현재의 2배로 멀어진다면, 만유인력의 크기는 어떻게 변할까요?",
          options: ["1/2 로 감소", "1/4 로 감소", "2배로 증가", "변함없음"],
          correctIndex: 1,
          explanation: "만유인력은 거리의 제곱에 반비례(F ∝ 1/r²)하므로, 거리가 2배가 되면 힘은 1/(2²) = 1/4 로 감소합니다."
        },
        {
          id: 2,
          question: "행성이 태양 주위를 타원 궤도로 돌 때, 태양에 가장 가까워지는 근일점에서 공전 속도는?",
          options: ["가장 느려진다", "가장 빨라진다", "일정하다", "0이 된다"],
          correctIndex: 1,
          explanation: "케플러 제2법칙(면적속도 일정의 법칙) 및 각운동량 보존 법칙에 의해 회전 반경이 작아지면 속도가 가장 빨라집니다."
        },
        {
          id: 3,
          question: "3체 문제(Three-body problem)의 일반해가 존재하지 않는 주된 이유는?",
          options: ["중력 상수가 계속 변해서", "비선형 중력 상호작용으로 인한 카오스적 궤도 민감성", "천체의 질량이 소멸해서", "빛의 속도 한계 때문에"],
          correctIndex: 1,
          explanation: "3개 이상의 상호작용 체계는 비선형 미분방정식으로 결합되어 해석적인 닫힌 해(closed-form)가 없으며 결정론적 혼돈을 보입니다."
        }
      ];
    case "wave":
      return [
        {
          id: 1,
          question: "영의 이중 슬릿 실험에서 두 슬릿 사이의 간격(d)을 더 좁히면 스크린의 간섭 줄무늬 간격(Δy)은?",
          options: ["더 넓어진다", "더 좁아진다", "변함없다", "간섭 줄무늬가 사라진다"],
          correctIndex: 0,
          explanation: "줄무늬 간격 Δy = (λ * L) / d 이므로, 슬릿 간격 d가 줄어들면 줄무늬 간격 Δy는 반비례하여 더 넓어집니다."
        },
        {
          id: 2,
          question: "두 파동이 만나 위상이 정확히 180도(π 라디안) 다를 때 일어나는 현상은?",
          options: ["보강 간섭 (진폭 2배)", "상쇄 간섭 (진폭 0)", "공명 현상", "파장 2배 증가"],
          correctIndex: 1,
          explanation: "위상이 반대인 두 파동의 골과 마루가 만나 합성 진폭이 상쇄되어 0이 되는 상쇄 간섭(Destructive Interference)이 일어납니다."
        }
      ];
    default:
      return [
        {
          id: 1,
          question: "공기 저항이 없는 진공 상태에서 수평면과 몇 도의 각도로 물체를 던질 때 수평 도달 거리가 최대가 될까요?",
          options: ["30도", "45도", "60도", "90도"],
          correctIndex: 1,
          explanation: "비거리 공식 R = (v₀² sin 2θ) / g 에서 sin(2θ)가 최대값 1을 갖는 조건은 2θ = 90°, 즉 θ = 45°일 때입니다."
        },
        {
          id: 2,
          question: "물체가 낙하할 때 공기 저항력이 중력과 정확히 같아져 가속도가 0이 되는 일정한 속도를 무엇이라 하나요?",
          options: ["탈출 속도", "종단 속도", "임계 속도", "상대 속도"],
          correctIndex: 1,
          explanation: "중력과 공기 항력이 평형(F_net = mg - F_drag = 0)을 이루어 더 이상 가속되지 않는 최고 속도를 종단 속도(Terminal Velocity)라고 합니다."
        }
      ];
  }
}

startServer();
