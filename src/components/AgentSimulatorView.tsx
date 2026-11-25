import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  AlertTriangle,
  Database,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Crosshair,
} from 'lucide-react';
import {
  XIAOMI_12_PRO_PROFILES,
  buildActionPayload,
  calculateResizedCaptureDimensions,
  normalizedToPixel,
  ratioToNormalized,
  type NormalizedPoint,
} from '../utils/coordinateMapper';
import {
  SIMULATION_SCENARIOS,
  advanceLoopStep,
  createInitialLoopState,
  simulateUnchangedFrame,
  type LoopState,
  type PhoneScreenId,
} from '../utils/loopSimulator';

function PhoneScreenContent({ screen }: { screen: PhoneScreenId }) {
  if (screen === 'lineage_home') {
    return (
      <div className="h-full flex flex-col justify-between p-4 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white select-none">
        <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
          <span>09:42</span>
          <span>5G · 94%</span>
        </div>

        <div className="space-y-6 my-auto">
          <div className="text-center space-y-1">
            <p className="text-2xl font-light tracking-tight tabular-nums">09:42</p>
            <p className="text-[10px] text-slate-400">LineageOS · Xiaomi 12 Pro</p>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-4">
            {[
              { name: 'Shopee', bg: 'bg-orange-600', label: 'S' },
              { name: 'Termux', bg: 'bg-slate-700', label: '>$' },
              { name: 'Magisk', bg: 'bg-emerald-700', label: 'M' },
              { name: 'Cài đặt', bg: 'bg-sky-700', label: '⚙' },
            ].map((app) => (
              <div key={app.name} className="flex flex-col items-center gap-1">
                <div
                  className={`w-10 h-10 rounded-xl ${app.bg} flex items-center justify-center text-xs font-bold shadow-sm`}
                >
                  {app.label}
                </div>
                <span className="text-[9px] text-slate-200 truncate max-w-full">{app.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-full px-3 py-1.5 text-[10px] text-slate-400 text-center">
          Tìm kiếm ứng dụng
        </div>
      </div>
    );
  }

  if (screen === 'shopee_home') {
    return (
      <div className="h-full flex flex-col bg-slate-50 text-slate-900 select-none">
        <div className="bg-orange-600 px-3 pt-3 pb-3 text-white space-y-2">
          <div className="flex justify-between text-[10px] font-mono opacity-90">
            <span>09:42</span>
            <span>Shopee VN</span>
          </div>
          <div className="bg-white text-slate-400 rounded px-2.5 py-1.5 text-[11px] flex items-center justify-between">
            <span>Tìm trên Shopee...</span>
            <span className="text-orange-600 font-semibold">Tìm</span>
          </div>
        </div>
        <div className="p-3 space-y-2.5 flex-1">
          <div className="bg-orange-100 rounded-lg p-3 text-orange-950">
            <p className="text-[10px] font-semibold">Flash Sale Linh kiện điện tử</p>
            <p className="text-xs font-bold mt-0.5">Giảm đến 40% mạch vi điều khiển</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-slate-200 rounded p-2 space-y-1">
              <div className="h-12 bg-slate-100 rounded" />
              <p className="text-[10px] font-medium truncate">Kit phát triển Wi-Fi</p>
              <p className="text-[10px] font-bold text-orange-600 tabular-nums">85.000đ</p>
            </div>
            <div className="bg-white border border-slate-200 rounded p-2 space-y-1">
              <div className="h-12 bg-slate-100 rounded" />
              <p className="text-[10px] font-medium truncate">Cảm biến nhiệt độ</p>
              <p className="text-[10px] font-bold text-orange-600 tabular-nums">29.000đ</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'shopee_search_focused' || screen === 'shopee_search_typed') {
    return (
      <div className="h-full flex flex-col justify-between bg-white text-slate-900 select-none">
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>09:42</span>
            <span>com.shopee.vn</span>
          </div>
          <div className="border-2 border-orange-500 rounded px-2.5 py-1.5 text-[11px] font-medium text-slate-900 bg-orange-50/40">
            {screen === 'shopee_search_typed' ? (
              <span>mạch ESP32-S3 SuperMini</span>
            ) : (
              <span className="text-slate-400">Nhập từ khóa tìm kiếm|</span>
            )}
          </div>
        </div>
        <div className="p-3 space-y-2 flex-1">
          <p className="text-[10px] font-semibold text-slate-500">Gợi ý tìm kiếm</p>
          {['mạch ESP32-S3 SuperMini', 'ESP32-S3 N16R8', 'ESP32-C3 SuperMini'].map((item) => (
            <div key={item} className="text-[11px] py-1.5 border-b border-slate-100 text-slate-700">
              {item}
            </div>
          ))}
        </div>
        <div className="bg-slate-200 p-2 text-center text-[10px] text-slate-600 font-mono">
          {screen === 'shopee_search_typed'
            ? 'Clipboard + KEYCODE_PASTE đã điền UTF-8'
            : 'Bàn phím hệ thống đang chờ nhập'}
        </div>
      </div>
    );
  }

  if (screen === 'shopee_results_relevance' || screen === 'shopee_results_price_asc') {
    const isPriceAsc = screen === 'shopee_results_price_asc';
    const products = isPriceAsc
      ? [
          { name: 'ESP32-S3 SuperMini Type-C (Mini)', price: '59.000đ', sold: 'Đã bán 1,2k' },
          { name: 'Mạch ESP32-S3 SuperMini 4MB Flash', price: '64.000đ', sold: 'Đã bán 840' },
          { name: 'ESP32-S3 SuperMini + Header hàn sẵn', price: '72.000đ', sold: 'Đã bán 410' },
        ]
      : [
          { name: 'Combo 2x ESP32-S3 SuperMini + Anten', price: '149.000đ', sold: 'Đã bán 520' },
          { name: 'Mạch ESP32-S3 SuperMini 4MB Flash', price: '64.000đ', sold: 'Đã bán 840' },
          { name: 'Kit ESP32-S3 DevKitC N16R8', price: '115.000đ', sold: 'Đã bán 1,9k' },
        ];

    return (
      <div className="h-full flex flex-col bg-slate-50 text-slate-900 select-none">
        <div className="bg-white border-b border-slate-200 px-3 pt-2.5 pb-2 space-y-2">
          <div className="bg-slate-100 rounded px-2 py-1 text-[10px] font-medium truncate">
            mạch ESP32-S3 SuperMini
          </div>
          <div className="grid grid-cols-4 text-[10px] text-center font-medium pt-0.5">
            <span className={!isPriceAsc ? 'text-orange-600 font-bold' : 'text-slate-500'}>
              Liên quan
            </span>
            <span className="text-slate-500">Mới nhất</span>
            <span className="text-slate-500">Bán chạy</span>
            <span className={isPriceAsc ? 'text-orange-600 font-bold' : 'text-slate-500'}>
              Giá ↑
            </span>
          </div>
        </div>
        <div className="p-2.5 space-y-2 flex-1 overflow-hidden">
          {products.map((p) => (
            <div
              key={p.name}
              className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-800 truncate">{p.name}</p>
                <p className="text-[9px] text-slate-400">{p.sold}</p>
              </div>
              <span className="text-[11px] font-bold text-orange-600 font-mono tabular-nums shrink-0">
                {p.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Settings screens
  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 p-3.5 space-y-3 select-none">
      <div className="flex justify-between text-[10px] font-mono text-slate-400">
        <span>09:42</span>
        <span>com.android.settings</span>
      </div>
      <h3 className="text-sm font-bold">
        {screen === 'settings_main'
          ? 'Cài đặt'
          : screen === 'settings_display'
            ? 'Hiển thị'
            : 'Tần số quét tối đa'}
      </h3>
      <div className="space-y-2 text-[11px]">
        {screen === 'settings_main' &&
          ['Mạng và Internet', 'Thiết bị đã kết nối', 'Hiển thị', 'Pin', 'Hệ thống'].map(
            (item) => (
              <div
                key={item}
                className={`px-2.5 py-2 rounded border ${
                  item === 'Hiển thị'
                    ? 'bg-slate-800 border-emerald-600/60 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {item}
              </div>
            )
          )}
        {screen === 'settings_display' &&
          ['Độ sáng thích ứng', 'Giao diện tối', 'Tần số quét tối đa (120Hz)', 'Độ phân giải WQHD+'].map(
            (item) => (
              <div
                key={item}
                className={`px-2.5 py-2 rounded border ${
                  item.includes('120Hz')
                    ? 'bg-slate-800 border-emerald-600/60 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {item}
              </div>
            )
          )}
        {screen === 'settings_refresh_rate' &&
          ['60 Hz (Tiết kiệm pin)', '90 Hz (Cân bằng)', '120 Hz (LTPO Mượt tối đa — Đang chọn)'].map(
            (item) => (
              <div
                key={item}
                className={`px-2.5 py-2.5 rounded border ${
                  item.includes('120 Hz')
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-200 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {item}
              </div>
            )
          )}
      </div>
    </div>
  );
}

export function AgentSimulatorView() {
  const [resolutionIdx, setResolutionIdx] = useState(0);
  const [loopState, setLoopState] = useState<LoopState>(() =>
    createInitialLoopState(SIMULATION_SCENARIOS[0].id)
  );
  const [autoRunning, setAutoRunning] = useState(false);

  // Interactive manual tap / payload inspector
  const [manualPoint, setManualPoint] = useState<NormalizedPoint>({ x: 500, y: 500 });
  const [actionType, setActionType] = useState<'tap' | 'swipe' | 'text' | 'key'>('tap');
  const [textPayload, setTextPayload] = useState('mạch ESP32-S3 SuperMini');
  const [keycode, setKeycode] = useState(4);

  const resolution = XIAOMI_12_PRO_PROFILES[resolutionIdx];
  const resizedCapture = useMemo(
    () => calculateResizedCaptureDimensions(resolution.width, resolution.height, 1280),
    [resolution]
  );

  const activeScenario = useMemo(
    () =>
      SIMULATION_SCENARIOS.find((s) => s.id === loopState.scenarioId) ??
      SIMULATION_SCENARIOS[0],
    [loopState.scenarioId]
  );

  const latestLog = loopState.logs[loopState.logs.length - 1];

  // Auto-run timer (1.2s UI settle loop)
  useEffect(() => {
    if (!autoRunning) return;
    if (
      loopState.status === 'completed' ||
      loopState.status === 'aborted_stuck' ||
      loopState.status === 'aborted_limit'
    ) {
      setAutoRunning(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoopState((prev) => advanceLoopStep(prev));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [autoRunning, loopState]);

  // Sync reticle when agent executes a tap
  const reticlePoint: NormalizedPoint = useMemo(() => {
    if (latestLog?.decision.action === 'tap' && latestLog.decision.x != null && latestLog.decision.y != null) {
      return { x: latestLog.decision.x, y: latestLog.decision.y };
    }
    return manualPoint;
  }, [latestLog, manualPoint]);

  const physicalPixel = useMemo(
    () => normalizedToPixel(reticlePoint, resolution),
    [reticlePoint, resolution]
  );

  const generatedPayload = useMemo(() => {
    if (actionType === 'tap') {
      return buildActionPayload({ type: 'tap', x: reticlePoint.x, y: reticlePoint.y });
    }
    if (actionType === 'swipe') {
      return buildActionPayload({
        type: 'swipe',
        x1: 500,
        y1: 800,
        x2: 500,
        y2: 200,
        duration: 300,
      });
    }
    if (actionType === 'text') {
      return buildActionPayload({ type: 'text', content: textPayload });
    }
    return buildActionPayload({ type: 'key', keycode });
  }, [actionType, reticlePoint, textPayload, keycode]);

  const handleScreenClick = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    setManualPoint(ratioToNormalized(rx, ry));
    setActionType('tap');
  };

  const handleSelectScenario = (scenarioId: string) => {
    setAutoRunning(false);
    setLoopState((prev) => createInitialLoopState(scenarioId, prev.skillCache));
  };

  const handleStep = () => {
    setAutoRunning(false);
    setLoopState((prev) => advanceLoopStep(prev));
  };

  const handleStuckTest = () => {
    setAutoRunning(false);
    setLoopState((prev) => simulateUnchangedFrame(prev));
  };

  const handleReset = () => {
    setAutoRunning(false);
    setLoopState((prev) => createInitialLoopState(prev.scenarioId, prev.skillCache));
  };

  const statusText: Record<LoopState['status'], string> = {
    idle: 'Sẵn sàng',
    running: 'Đang lặp Perception-Action',
    completed: 'Hoàn tất & đã lưu SQLite cache',
    aborted_stuck: 'Đã tự dừng (3 khung hình dHash không đổi)',
    aborted_limit: 'Chạm trần max_steps = 15',
  };

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* Header & Controls */}
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-mono">
            http://127.0.0.1:8765 · Perception-Action Loop · Tọa độ chuẩn hóa [0–1000]
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Mô phỏng Cầu nối Bridge &amp; Vòng lặp Gemini Agent
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 min-w-0">
            <label
              htmlFor="scenario-select"
              className="text-xs font-semibold text-slate-600 whitespace-nowrap shrink-0"
            >
              Kịch bản:
            </label>
            <select
              id="scenario-select"
              value={loopState.scenarioId}
              onChange={(e) => handleSelectScenario(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              {SIMULATION_SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleStep}
              disabled={loopState.status === 'completed' || loopState.status === 'aborted_stuck'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Chạy từng bước</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRunning((v) => !v)}
              disabled={loopState.status === 'completed' || loopState.status === 'aborted_stuck'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {autoRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Chạy tự động</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleStuckTest}
              disabled={loopState.status === 'completed' || loopState.status === 'aborted_stuck'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Thử treo dHash</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Đặt lại</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <section
        aria-label="Thông số vòng lặp"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 divide-x divide-slate-200"
      >
        <div className="p-4 space-y-0.5">
          <p className="text-xs text-slate-500">Trạng thái vòng lặp</p>
          <p
            className={`text-sm font-bold ${
              loopState.status === 'completed'
                ? 'text-emerald-700'
                : loopState.status === 'aborted_stuck'
                  ? 'text-red-700'
                  : 'text-slate-900'
            }`}
          >
            {statusText[loopState.status]}
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            Bước {loopState.stepIndex} / 15 tối đa
          </p>
        </div>

        <div className="p-4 space-y-0.5">
          <p className="text-xs text-slate-500">Giới hạn RPM (cửa sổ 60s)</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
            {loopState.rpmUsed} / {loopState.maxRpm}
          </p>
          <p className="text-xs text-slate-500">SafetySetting: BLOCK_NONE</p>
        </div>

        <div className="p-4 space-y-0.5">
          <p className="text-xs text-slate-500">Chống kẹt màn hình (dHash)</p>
          <p
            className={`text-lg font-bold font-mono tabular-nums ${
              loopState.unchangedStreak >= 2 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {loopState.unchangedStreak} / {loopState.stuckLimit} khung hình
          </p>
          <p className="text-xs text-slate-500">Tự dừng nếu 3 bước liên tiếp trùng</p>
        </div>

        <div className="p-4 space-y-0.5">
          <p className="text-xs text-slate-500">Nén /screenshot JPEG</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
            {resizedCapture.width}×{resizedCapture.height}
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            Gốc {resolution.width}×{resolution.height} · Quality 70
          </p>
        </div>
      </section>

      {/* Main 2-Column Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Xiaomi 12 Pro Coordinate Canvas */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Màn hình Xiaomi 12 Pro</h2>
              <p className="text-xs text-slate-500">Nhấp trực tiếp để đo tọa độ [0–1000]</p>
            </div>
            <label htmlFor="res-select" className="sr-only">
              Độ phân giải thiết bị
            </label>
            <select
              id="res-select"
              value={resolutionIdx}
              onChange={(e) => setResolutionIdx(Number(e.target.value))}
              className="px-2 py-1 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded text-slate-700"
            >
              {XIAOMI_12_PRO_PROFILES.map((p, idx) => (
                <option key={p.label} value={idx}>
                  {p.width}×{p.height}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleScreenClick}
              aria-label="Màn hình mô phỏng Xiaomi 12 Pro — nhấp để chọn tọa độ tap chuẩn hóa"
              className="relative w-64 h-[512px] rounded-[28px] border-[6px] border-slate-900 overflow-hidden shadow-sm text-left cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <PhoneScreenContent screen={loopState.currentScreen} />

              {/* Reticle Marker */}
              <div
                aria-hidden="true"
                style={{
                  left: `${reticlePoint.x / 10}%`,
                  top: `${reticlePoint.y / 10}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              >
                <div className="w-7 h-7 rounded-full border-2 border-emerald-400 bg-emerald-500/20 flex items-center justify-center">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-300" />
                </div>
              </div>
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-500">Chuẩn hóa [0–1000]:</span>
              <span className="font-semibold text-slate-900">
                ({reticlePoint.x}, {reticlePoint.y})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pixel thực tế:</span>
              <span className="font-semibold text-emerald-700">
                ({physicalPixel.x}px, {physicalPixel.y}px)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Foreground package:</span>
              <span className="text-slate-800 truncate max-w-[165px]">
                {loopState.currentPackage}
              </span>
            </div>
          </div>
        </section>

        {/* Right: Bridge Payload Tester + Gemini Perception-Action Trace + SQLite Skill Cache */}
        <div className="lg:col-span-8 space-y-6">
          {/* Perception-Action Trace */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Nhật ký vòng lặp Perception-Action (Structured JSON)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mục tiêu: &ldquo;{activeScenario.goal}&rdquo;
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 shrink-0">
                gemini-2.5-flash · JSON Schema
              </span>
            </div>

            <div className="p-4 bg-slate-950 text-slate-100 max-h-[340px] overflow-y-auto code-scroll space-y-3">
              {loopState.logs.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm text-slate-300">
                    Chưa có bước nào được thực thi. Nhấn &ldquo;Chạy từng bước&rdquo; hoặc &ldquo;Chạy tự động&rdquo; để quan sát vòng lặp.
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    GET /ui_info → GET /screenshot → Gemini JSON → POST /action → sleep(1.2s)
                  </p>
                </div>
              ) : (
                loopState.logs.map((entry) => (
                  <div
                    key={`${entry.step}-${entry.dhash}-${entry.unchangedFlag}`}
                    className="border border-slate-800 bg-slate-900/70 rounded-lg p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="font-semibold text-emerald-400 tabular-nums">
                        Bước {String(entry.step).padStart(2, '0')} · {entry.foregroundPackage}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        dHash: {entry.dhash} · {entry.latencyMs}ms · {entry.bridgeStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {entry.decision.thought}
                    </p>
                    <pre className="text-[11px] font-mono text-sky-300 bg-slate-950 border border-slate-800 rounded p-2.5 overflow-x-auto">
                      {JSON.stringify(entry.decision, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Bottom Grid: POST /action Builder + SQLite agent_memory.db */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* POST /action Builder */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900">
                  Trình tạo lệnh POST /action
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  POST http://127.0.0.1:8765/action
                </p>
              </div>

              <div
                role="group"
                aria-label="Chọn loại lệnh Bridge"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {(['tap', 'swipe', 'text', 'key'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActionType(t)}
                    className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                      actionType === t
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {actionType === 'text' && (
                <div className="space-y-1">
                  <label
                    htmlFor="text-payload-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Văn bản tiếng Việt (Clipboard + KEYCODE_PASTE)
                  </label>
                  <input
                    id="text-payload-input"
                    type="text"
                    value={textPayload}
                    onChange={(e) => setTextPayload(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {actionType === 'key' && (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: 4, label: 'Back (4)' },
                    { code: 3, label: 'Home (3)' },
                    { code: 187, label: 'Recents (187)' },
                    { code: 66, label: 'Enter (66)' },
                  ].map((k) => (
                    <button
                      key={k.code}
                      type="button"
                      onClick={() => setKeycode(k.code)}
                      className={`px-2.5 py-1.5 text-xs font-mono rounded-md border cursor-pointer ${
                        keycode === k.code
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              )}

              <pre className="bg-slate-950 text-emerald-300 font-mono text-xs p-3.5 rounded-lg overflow-x-auto">
                {JSON.stringify(generatedPayload, null, 2)}
              </pre>
            </section>

            {/* SQLite Skill Cache Table */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <span>SQLite Skill Cache (agent_memory.db)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tự động lưu chuỗi bước khi vòng lặp đạt action=&ldquo;done&rdquo;
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                  {loopState.skillCache.length} bản ghi
                </span>
              </div>

              {loopState.skillCache.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-lg p-5 text-center space-y-1.5">
                  <p className="text-xs font-medium text-slate-700">
                    Bảng `skills` hiện chưa có bản ghi nào
                  </p>
                  <p className="text-xs text-slate-500">
                    Hãy chạy xong kịch bản Shopee hoặc 120Hz để xem Agent ghi cache tự động.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {loopState.skillCache.map((item) => (
                    <div key={item.goalHash} className="p-3 bg-slate-50/50 space-y-1">
                      <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                        {item.goal}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-slate-500 tabular-nums">
                        <span>hash:{item.goalHash}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.stepCount} bước</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-semibold">
                          Thành công {item.successCount}×
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
