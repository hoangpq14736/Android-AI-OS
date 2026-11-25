export type PhoneScreenId =
  | 'lineage_home'
  | 'shopee_home'
  | 'shopee_search_focused'
  | 'shopee_search_typed'
  | 'shopee_results_relevance'
  | 'shopee_results_price_asc'
  | 'settings_main'
  | 'settings_display'
  | 'settings_refresh_rate';

export interface AgentDecision {
  thought: string;
  action: 'tap' | 'swipe' | 'text' | 'key' | 'wait' | 'done';
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  duration?: number;
  content?: string;
  keycode?: number;
  status: 'in_progress' | 'completed' | 'failed' | 'blocked';
}

export interface SimulatedStep {
  stepNumber: number;
  beforeScreen: PhoneScreenId;
  afterScreen: PhoneScreenId;
  foregroundPackage: string;
  foregroundActivity: string;
  dhash: string;
  latencyMs: number;
  decision: AgentDecision;
}

export interface SimulationScenario {
  id: string;
  title: string;
  goal: string;
  initialScreen: PhoneScreenId;
  initialPackage: string;
  steps: SimulatedStep[];
}

export interface SkillCacheEntry {
  goalHash: string;
  goal: string;
  startPackage: string;
  stepCount: number;
  successCount: number;
  lastRunLabel: string;
}

export interface LoopState {
  scenarioId: string;
  stepIndex: number;
  currentScreen: PhoneScreenId;
  currentPackage: string;
  rpmUsed: number;
  maxRpm: number;
  unchangedStreak: number;
  stuckLimit: number;
  status: 'idle' | 'running' | 'completed' | 'aborted_stuck' | 'aborted_limit';
  logs: Array<{
    step: number;
    foregroundPackage: string;
    dhash: string;
    latencyMs: number;
    decision: AgentDecision;
    bridgeStatus: string;
    unchangedFlag: boolean;
  }>;
  skillCache: SkillCacheEntry[];
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: 'shopee_esp32',
    title: 'Shopee: Tìm ESP32-S3 SuperMini giá thấp nhất',
    goal: 'Mở Shopee, tìm mạch ESP32-S3 SuperMini và sắp xếp theo giá từ thấp đến cao',
    initialScreen: 'lineage_home',
    initialPackage: 'com.android.launcher3',
    steps: [
      {
        stepNumber: 1,
        beforeScreen: 'lineage_home',
        afterScreen: 'shopee_home',
        foregroundPackage: 'com.android.launcher3',
        foregroundActivity: '.uioverrides.QuickstepLauncher',
        dhash: '9e4c3a21f0b8c102',
        latencyMs: 640,
        decision: {
          thought: 'Đang ở màn hình chính LineageOS. Biểu tượng Shopee nằm ở hàng ứng dụng giữa bên trái (220, 460), cần nhấn mở ứng dụng.',
          action: 'tap',
          x: 220,
          y: 460,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 2,
        beforeScreen: 'shopee_home',
        afterScreen: 'shopee_search_focused',
        foregroundPackage: 'com.shopee.vn',
        foregroundActivity: '.app.ui.home.HomeActivity_',
        dhash: '4b10e9a7c8332d11',
        latencyMs: 710,
        decision: {
          thought: 'Shopee đã mở hoàn tất. Thanh tìm kiếm nằm ở đầu màn hình tại (460, 105), cần chạm vào để kích hoạt con trỏ nhập liệu.',
          action: 'tap',
          x: 460,
          y: 105,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 3,
        beforeScreen: 'shopee_search_focused',
        afterScreen: 'shopee_search_typed',
        foregroundPackage: 'com.shopee.vn',
        foregroundActivity: '.app.ui.search.SearchActivity_',
        dhash: '7f02cc18b490ae44',
        latencyMs: 580,
        decision: {
          thought: 'Ô tìm kiếm đã được focus. Bơm từ khóa có dấu bằng hành động text (ClipboardManager + KEYCODE_PASTE).',
          action: 'text',
          content: 'mạch ESP32-S3 SuperMini',
          status: 'in_progress',
        },
      },
      {
        stepNumber: 4,
        beforeScreen: 'shopee_search_typed',
        afterScreen: 'shopee_results_relevance',
        foregroundPackage: 'com.shopee.vn',
        foregroundActivity: '.app.ui.search.SearchActivity_',
        dhash: '1c89ab52ef4009d3',
        latencyMs: 520,
        decision: {
          thought: 'Đã điền xong "mạch ESP32-S3 SuperMini". Gửi phím Enter (keycode 66) để thực hiện truy vấn tìm kiếm.',
          action: 'key',
          keycode: 66,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 5,
        beforeScreen: 'shopee_results_relevance',
        afterScreen: 'shopee_results_price_asc',
        foregroundPackage: 'com.shopee.vn',
        foregroundActivity: '.app.ui.search.SearchResultActivity_',
        dhash: 'a3d74e91c0128f65',
        latencyMs: 690,
        decision: {
          thought: 'Danh sách sản phẩm ESP32-S3 SuperMini đang sắp xếp theo Liên quan. Nhấn tab "Giá" ở (840, 195) để lọc từ thấp đến cao.',
          action: 'tap',
          x: 840,
          y: 195,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 6,
        beforeScreen: 'shopee_results_price_asc',
        afterScreen: 'shopee_results_price_asc',
        foregroundPackage: 'com.shopee.vn',
        foregroundActivity: '.app.ui.search.SearchResultActivity_',
        dhash: 'e58b02f491a77c20',
        latencyMs: 495,
        decision: {
          thought: 'Sản phẩm ESP32-S3 SuperMini đã sắp xếp theo giá tăng dần (từ 59.000đ). Đạt trọn vẹn mục tiêu, kết thúc vòng lặp và lưu skill cache.',
          action: 'done',
          status: 'completed',
        },
      },
    ],
  },
  {
    id: 'lineage_120hz',
    title: 'LineageOS: Bật tần số quét 120Hz trên Xiaomi 12 Pro',
    goal: 'Mở Cài đặt, vào Hiển thị và kiểm tra chế độ tần số quét mượt 120Hz',
    initialScreen: 'lineage_home',
    initialPackage: 'com.android.launcher3',
    steps: [
      {
        stepNumber: 1,
        beforeScreen: 'lineage_home',
        afterScreen: 'settings_main',
        foregroundPackage: 'com.android.launcher3',
        foregroundActivity: '.uioverrides.QuickstepLauncher',
        dhash: '9e4c3a21f0b8c102',
        latencyMs: 560,
        decision: {
          thought: 'Biểu tượng Cài đặt nằm ở (760, 460) trên màn hình chính LineageOS. Chạm để mở Cài đặt hệ thống.',
          action: 'tap',
          x: 760,
          y: 460,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 2,
        beforeScreen: 'settings_main',
        afterScreen: 'settings_display',
        foregroundPackage: 'com.android.settings',
        foregroundActivity: '.Settings',
        dhash: '22f91c4e8a10903b',
        latencyMs: 615,
        decision: {
          thought: 'Mục "Hiển thị" nằm tại (480, 390) trong danh sách Cài đặt. Nhấn để mở tùy chọn màn hình LTPO AMOLED.',
          action: 'tap',
          x: 480,
          y: 390,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 3,
        beforeScreen: 'settings_display',
        afterScreen: 'settings_refresh_rate',
        foregroundPackage: 'com.android.settings',
        foregroundActivity: '.SubSettings',
        dhash: '64d2a190bc3e5f80',
        latencyMs: 605,
        decision: {
          thought: 'Đã vào cài đặt Hiển thị. Nhấn vào "Tần số quét tối đa" tại (500, 560) để xác nhận 120Hz.',
          action: 'tap',
          x: 500,
          y: 560,
          status: 'in_progress',
        },
      },
      {
        stepNumber: 4,
        beforeScreen: 'settings_refresh_rate',
        afterScreen: 'settings_refresh_rate',
        foregroundPackage: 'com.android.settings',
        foregroundActivity: '.SubSettings',
        dhash: '88c1e742aa041b99',
        latencyMs: 470,
        decision: {
          thought: 'Màn hình xác nhận Tần số quét tối đa đang chọn 120Hz. Hoàn thành mục tiêu.',
          action: 'done',
          status: 'completed',
        },
      },
    ],
  },
];

export function createInitialLoopState(
  scenarioId: string = SIMULATION_SCENARIOS[0].id,
  existingCache: SkillCacheEntry[] = []
): LoopState {
  const scenario =
    SIMULATION_SCENARIOS.find((s) => s.id === scenarioId) ?? SIMULATION_SCENARIOS[0];
  return {
    scenarioId: scenario.id,
    stepIndex: 0,
    currentScreen: scenario.initialScreen,
    currentPackage: scenario.initialPackage,
    rpmUsed: 0,
    maxRpm: 12,
    unchangedStreak: 0,
    stuckLimit: 3,
    status: 'idle',
    logs: [],
    skillCache: existingCache,
  };
}

export function advanceLoopStep(state: LoopState): LoopState {
  if (state.status === 'completed' || state.status === 'aborted_stuck' || state.status === 'aborted_limit') {
    return state;
  }

  const scenario =
    SIMULATION_SCENARIOS.find((s) => s.id === state.scenarioId) ?? SIMULATION_SCENARIOS[0];

  if (state.stepIndex >= scenario.steps.length) {
    return { ...state, status: 'completed' };
  }

  const step = scenario.steps[state.stepIndex];
  const nextRpm = Math.min(state.maxRpm, state.rpmUsed + 1);
  const isDone = step.decision.action === 'done' || step.decision.status === 'completed';

  const newLogs = [
    ...state.logs,
    {
      step: step.stepNumber,
      foregroundPackage: step.foregroundPackage,
      dhash: step.dhash,
      latencyMs: step.latencyMs,
      decision: step.decision,
      bridgeStatus: isDone ? 'completed' : '200 OK (POST /action)',
      unchangedFlag: false,
    },
  ];

  let updatedCache = state.skillCache;
  if (isDone) {
    const hash = scenario.id === 'shopee_esp32' ? 'a9f31d8c04e2' : 'c47e9b2180fa';
    const existing = state.skillCache.find((c) => c.goalHash === hash);
    if (existing) {
      updatedCache = state.skillCache.map((c) =>
        c.goalHash === hash
          ? { ...c, successCount: c.successCount + 1, lastRunLabel: 'Vừa xong' }
          : c
      );
    } else {
      updatedCache = [
        {
          goalHash: hash,
          goal: scenario.goal,
          startPackage: scenario.initialPackage,
          stepCount: scenario.steps.length - 1,
          successCount: 1,
          lastRunLabel: 'Vừa lưu',
        },
        ...state.skillCache,
      ];
    }
  }

  return {
    ...state,
    stepIndex: state.stepIndex + 1,
    currentScreen: step.afterScreen,
    currentPackage: isDone
      ? step.foregroundPackage
      : (scenario.steps[state.stepIndex + 1]?.foregroundPackage ?? step.foregroundPackage),
    rpmUsed: nextRpm,
    unchangedStreak: 0,
    status: isDone ? 'completed' : 'running',
    logs: newLogs,
    skillCache: updatedCache,
  };
}

/**
 * Mô phỏng cơ chế Guard phát hiện 3 khung hình dHash giống hệt nhau liên tiếp.
 */
export function simulateUnchangedFrame(state: LoopState): LoopState {
  if (state.status === 'completed' || state.status === 'aborted_stuck') {
    return state;
  }

  const nextStreak = state.unchangedStreak + 1;
  const aborted = nextStreak >= state.stuckLimit;
  const lastDhash = state.logs[state.logs.length - 1]?.dhash ?? '9e4c3a21f0b8c102';

  return {
    ...state,
    rpmUsed: aborted ? state.rpmUsed : Math.min(state.maxRpm, state.rpmUsed + 1),
    unchangedStreak: nextStreak,
    status: aborted ? 'aborted_stuck' : 'running',
    logs: [
      ...state.logs,
      {
        step: state.logs.length + 1,
        foregroundPackage: state.currentPackage,
        dhash: lastDhash,
        latencyMs: aborted ? 18 : 510,
        decision: aborted
          ? {
              thought: 'Guard dừng an toàn: phát hiện 3 bước liên tiếp dHash không thay đổi (Hamming distance = 0).',
              action: 'wait',
              status: 'blocked',
            }
          : {
              thought: `Màn hình chưa đổi (dHash trùng khớp ${nextStreak}/${state.stuckLimit}). Thử chờ UI phản hồi.`,
              action: 'wait',
              status: 'in_progress',
            },
        bridgeStatus: aborted ? 'ABORTED (Tiết kiệm API credit)' : '200 OK (wait)',
        unchangedFlag: true,
      },
    ],
  };
}
