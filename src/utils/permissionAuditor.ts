export type PermissionLevel = 'signature|privileged' | 'runtime' | 'normal' | 'special';

export interface AuditedPermission {
  name: string;
  shortName: string;
  level: PermissionLevel;
  declaredInManifest: boolean;
  whitelistedInXml: boolean;
  bootloopRisk: boolean;
  purpose: string;
}

export interface PermissionAuditReport {
  packageName: string;
  items: AuditedPermission[];
  totalDeclared: number;
  privilegedCount: number;
  whitelistedCount: number;
  bootloopRiskCount: number;
  isSafeToFlash: boolean;
}

const KNOWN_PERMISSION_META: Record<
  string,
  { level: PermissionLevel; purpose: string }
> = {
  'android.permission.INJECT_EVENTS': {
    level: 'signature|privileged',
    purpose: 'Bơm sự kiện chạm, vuốt, phím cứng qua InputManagerGlobal/InputManager.',
  },
  'android.permission.READ_FRAME_BUFFER': {
    level: 'signature|privileged',
    purpose: 'Đọc trực tiếp framebuffer màn hình qua ScreenCapture/SurfaceControl không cần popup.',
  },
  'android.permission.CAPTURE_VIDEO_OUTPUT': {
    level: 'signature|privileged',
    purpose: 'Cho phép chụp lớp hiển thị hệ thống (kể cả lớp bảo mật) trên Android 14/15/16.',
  },
  'android.permission.REAL_GET_TASKS': {
    level: 'signature|privileged',
    purpose: 'Đọc foreground package & activity trực tiếp qua ActivityTaskManager.getService().',
  },
  'android.permission.PACKAGE_USAGE_STATS': {
    level: 'signature|privileged',
    purpose: 'Dự phòng xác định ứng dụng foreground qua UsageStatsManager khi cần.',
  },
  'android.permission.INTERACT_ACROSS_USERS': {
    level: 'signature|privileged',
    purpose: 'Tương tác dịch vụ hệ thống xuyên user profile trong LineageOS.',
  },
  'android.permission.START_ACTIVITIES_FROM_BACKGROUND': {
    level: 'signature|privileged',
    purpose: 'Cho phép đánh thức thành phần nền ổn định sau khi khởi động lại.',
  },
  'android.permission.POST_NOTIFICATIONS': {
    level: 'runtime',
    purpose: 'Hiển thị thông báo tối giản cho Foreground Service trên Android 13–16.',
  },
  'android.permission.FOREGROUND_SERVICE': {
    level: 'normal',
    purpose: 'Chạy AiOsBridgeService ở chế độ nền trước ổn định.',
  },
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE': {
    level: 'special',
    purpose: 'Khai báo loại specialUse bắt buộc trên Android 14/15/16 cho Foreground Service.',
  },
  'android.permission.RECEIVE_BOOT_COMPLETED': {
    level: 'normal',
    purpose: 'Cho phép BootReceiver khởi động cầu nối ngay khi thiết bị boot xong.',
  },
  'android.permission.INTERNET': {
    level: 'normal',
    purpose: 'Mở ServerSocket nội bộ lắng nghe duy nhất tại 127.0.0.1:8765.',
  },
  'android.permission.WAKE_LOCK': {
    level: 'normal',
    purpose: 'Giữ tác vụ phản hồi HTTP không bị ngắt giữa chừng khi chụp màn hình.',
  },
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS': {
    level: 'normal',
    purpose: 'Hỗ trợ giữ dịch vụ cầu nối không bị Doze chế độ ngủ sâu chấm dứt.',
  },
  'android.permission.QUERY_ALL_PACKAGES': {
    level: 'special',
    purpose: 'Truy vấn tên gói ứng dụng đang chạy để gửi ngữ cảnh cho Gemini Agent.',
  },
};

export function extractManifestPermissions(manifestXml: string): string[] {
  const results: string[] = [];
  const regex = /<uses-permission[^>]*android:name="([^"]+)"/g;
  let match = regex.exec(manifestXml);
  while (match !== null) {
    if (!results.includes(match[1])) {
      results.push(match[1]);
    }
    match = regex.exec(manifestXml);
  }
  return results;
}

export function extractWhitelistPermissions(privappXml: string): {
  packageName: string;
  permissions: string[];
} {
  const pkgMatch = privappXml.match(/<privapp-permissions[^>]*package="([^"]+)"/);
  const packageName = pkgMatch ? pkgMatch[1] : 'unknown';
  const permissions: string[] = [];
  const regex = /<permission[^>]*name="([^"]+)"/g;
  let match = regex.exec(privappXml);
  while (match !== null) {
    if (!permissions.includes(match[1])) {
      permissions.push(match[1]);
    }
    match = regex.exec(privappXml);
  }
  return { packageName, permissions };
}

export function auditPrivAppPermissions(
  manifestXml: string,
  privappXml: string
): PermissionAuditReport {
  const declared = extractManifestPermissions(manifestXml);
  const { packageName, permissions: whitelisted } = extractWhitelistPermissions(privappXml);

  const allNames = Array.from(new Set([...declared, ...whitelisted]));
  const items: AuditedPermission[] = allNames.map((name) => {
    const meta = KNOWN_PERMISSION_META[name] ?? {
      level: 'normal' as PermissionLevel,
      purpose: 'Quyền hệ thống bổ sung.',
    };
    const declaredInManifest = declared.includes(name);
    const whitelistedInXml = whitelisted.includes(name);
    const bootloopRisk =
      meta.level === 'signature|privileged' && declaredInManifest && !whitelistedInXml;

    return {
      name,
      shortName: name.replace('android.permission.', ''),
      level: meta.level,
      declaredInManifest,
      whitelistedInXml,
      bootloopRisk,
      purpose: meta.purpose,
    };
  });

  const privilegedCount = items.filter((i) => i.level === 'signature|privileged').length;
  const whitelistedCount = items.filter(
    (i) => i.level === 'signature|privileged' && i.whitelistedInXml
  ).length;
  const bootloopRiskCount = items.filter((i) => i.bootloopRisk).length;

  return {
    packageName,
    items,
    totalDeclared: declared.length,
    privilegedCount,
    whitelistedCount,
    bootloopRiskCount,
    isSafeToFlash: bootloopRiskCount === 0 && privilegedCount > 0,
  };
}
