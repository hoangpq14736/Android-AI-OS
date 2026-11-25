export interface ScreenResolution {
  width: number;
  height: number;
  label: string;
}

export const XIAOMI_12_PRO_PROFILES: ScreenResolution[] = [
  { width: 1440, height: 3200, label: 'Xiaomi 12 Pro WQHD+ (1440×3200)' },
  { width: 1080, height: 2400, label: 'Xiaomi 12 Pro FHD+ (1080×2400)' },
  { width: 3200, height: 1440, label: 'Xiaomi 12 Pro Ngang (3200×1440)' },
];

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1000, Math.round(value)));
}

/**
 * Quy đổi tọa độ chuẩn hóa [0..1000] sang pixel thực tế giống hệt InputInjector.kt.
 */
export function normalizedToPixel(
  norm: NormalizedPoint,
  resolution: { width: number; height: number }
): PixelPoint {
  const cx = clampNormalized(norm.x);
  const cy = clampNormalized(norm.y);
  return {
    x: Math.round((cx / 1000) * (resolution.width - 1)),
    y: Math.round((cy / 1000) * (resolution.height - 1)),
  };
}

/**
 * Quy đổi tỷ lệ nhấp chuột trên khung mô phỏng [0..1] sang tọa độ chuẩn hóa [0..1000].
 */
export function ratioToNormalized(ratioX: number, ratioY: number): NormalizedPoint {
  return {
    x: clampNormalized(ratioX * 1000),
    y: clampNormalized(ratioY * 1000),
  };
}

/**
 * Tính kích thước ảnh JPEG sau khi thu nhỏ cạnh dài tối đa 1280px giống ScreenCapturer.kt.
 */
export function calculateResizedCaptureDimensions(
  width: number,
  height: number,
  maxLongEdge = 1280
): { width: number; height: number; scale: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height, scale: 1 };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export type BridgeActionPayload =
  | { type: 'tap'; x: number; y: number }
  | { type: 'swipe'; x1: number; y1: number; x2: number; y2: number; duration: number }
  | { type: 'text'; content: string }
  | { type: 'key'; keycode: number };

export function buildActionPayload(
  action: BridgeActionPayload
): Record<string, string | number> {
  switch (action.type) {
    case 'tap':
      return {
        type: 'tap',
        x: clampNormalized(action.x),
        y: clampNormalized(action.y),
      };
    case 'swipe':
      return {
        type: 'swipe',
        x1: clampNormalized(action.x1),
        y1: clampNormalized(action.y1),
        x2: clampNormalized(action.x2),
        y2: clampNormalized(action.y2),
        duration: Math.max(50, Math.min(3000, Math.round(action.duration))),
      };
    case 'text':
      return {
        type: 'text',
        content: action.content,
      };
    case 'key':
      return {
        type: 'key',
        keycode: Math.round(action.keycode),
      };
  }
}
