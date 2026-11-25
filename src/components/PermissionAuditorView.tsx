import { useMemo, useState } from 'react';
import { CheckCircle2, ShieldAlert, ShieldCheck, ExternalLink } from 'lucide-react';
import { RAW_MANIFEST_XML, RAW_PRIVAPP_XML } from '../data/prototypeFiles';
import { auditPrivAppPermissions, type PermissionLevel } from '../utils/permissionAuditor';

interface PermissionAuditorViewProps {
  onOpenFile: (fileId: string) => void;
}

type FilterMode = 'all' | 'privileged' | 'other';

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  'signature|privileged': 'signature|privileged',
  runtime: 'runtime (pm grant)',
  normal: 'normal',
  special: 'special (FGS / Query)',
};

export function PermissionAuditorView({ onOpenFile }: PermissionAuditorViewProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const report = useMemo(
    () => auditPrivAppPermissions(RAW_MANIFEST_XML, RAW_PRIVAPP_XML),
    []
  );

  const visibleItems = useMemo(() => {
    if (filter === 'privileged') {
      return report.items.filter((i) => i.level === 'signature|privileged');
    }
    if (filter === 'other') {
      return report.items.filter((i) => i.level !== 'signature|privileged');
    }
    return report.items;
  }, [report, filter]);

  return (
    <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-mono">
            Đối chiếu trực tiếp AndroidManifest.xml · privapp-permissions-ai.os.bridge.xml
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kiểm toán Priv-App &amp; Chống Bootloop Android 14/15/16
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Từ Android 9 trở đi (đặc biệt siết chặt trên LineageOS 21/22/23), PackageManager sẽ
            ném <code className="font-mono text-xs text-slate-800">IllegalStateException</code> và gây bootloop nếu APK trong{' '}
            <code className="font-mono text-xs text-slate-800">/system/priv-app</code> yêu cầu quyền{' '}
            <code className="font-mono text-xs text-slate-800">signature|privileged</code> mà chưa khai báo trong XML whitelist.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenFile('android-bridge/app/src/main/AndroidManifest.xml')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Mở AndroidManifest.xml</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenFile(
                'magisk-module/system/etc/permissions/privapp-permissions-ai.os.bridge.xml'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Mở Whitelist XML</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <section
        aria-label="Tóm tắt kiểm toán quyền"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500">Gói hệ thống (Package)</p>
          <p className="text-lg font-bold font-mono text-slate-900">{report.packageName}</p>
          <p className="text-xs text-slate-500">Mount tại /system/priv-app/AiOsBridge</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500">Tổng quyền khai báo</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {report.totalDeclared}
          </p>
          <p className="text-xs text-slate-500">Đọc tự động từ AndroidManifest.xml</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500">Đặc quyền đã whitelist</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {report.whitelistedCount} / {report.privilegedCount}
          </p>
          <p className="text-xs text-slate-500">Khớp 100% quyền signature|privileged</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-500">Đánh giá an toàn boot</p>
          <div className="flex items-center gap-2 pt-0.5">
            {report.isSafeToFlash ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
                <span className="text-base font-bold text-emerald-800">An toàn để flash</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                <span className="text-base font-bold text-red-700">
                  Có {report.bootloopRiskCount} quyền thiếu whitelist
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">0 nguy cơ PackageManager crash</p>
        </div>
      </section>

      {/* Filter Toolbar + Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">
            Bảng đối chiếu chi tiết ({visibleItems.length} quyền)
          </h2>

          <div
            role="group"
            aria-label="Lọc nhóm quyền"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto"
          >
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'privileged', label: 'Đặc quyền (Privileged)' },
                { id: 'other', label: 'Runtime & Hệ thống' },
              ] as const
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-5">Quyền Android</th>
                <th className="py-3 px-4">Mức bảo vệ</th>
                <th className="py-3 px-4">Trạng thái Whitelist</th>
                <th className="py-3 px-5">Vai trò trong ai.os.bridge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {visibleItems.map((item) => (
                <tr key={item.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                    {item.shortName}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {LEVEL_LABELS[item.level]}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.level === 'signature|privileged' ? (
                      item.whitelistedInXml ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Đã whitelist</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Thiếu whitelist (Bootloop)</span>
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-500">Không bắt buộc XML</span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-xs text-slate-600 leading-relaxed">
                    {item.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
