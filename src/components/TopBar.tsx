import { Download } from 'lucide-react';

export type WorkspaceTab = 'code' | 'audit' | 'simulator' | 'deploy';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onDownloadZip: () => void;
  downloading: boolean;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'code', label: 'Mã nguồn' },
  { id: 'audit', label: 'Kiểm tra quyền' },
  { id: 'simulator', label: 'Mô phỏng Agent' },
  { id: 'deploy', label: 'Ký APK & Flash' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onDownloadZip,
  downloading,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 lg:gap-8">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('code');
        }}
        className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
      >
        Android AI OS Prototype
      </a>

      <nav
        aria-label="Điều hướng chính"
        className="flex items-center gap-1 sm:gap-5 overflow-x-auto no-scrollbar"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-4 px-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                isActive
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 bottom-0 h-0.5 bg-emerald-600"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onDownloadZip}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{downloading ? 'Đang nén...' : 'Tải gói .zip'}</span>
        </button>
      </div>
    </header>
  );
}
