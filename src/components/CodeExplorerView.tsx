import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, FolderOpen, Search, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  PROTOTYPE_FILES,
  type PrototypeCategory,
} from '../data/prototypeFiles';
import { tokenizeCodeLine, type TokenType } from '../utils/codeTokenizer';

interface CodeExplorerViewProps {
  selectedFileId: string;
  onSelectFile: (fileId: string) => void;
}

const CATEGORY_ORDER: PrototypeCategory[] = [
  'android-bridge',
  'magisk-module',
  'python-agent',
  'docs',
];

const TOKEN_CLASSES: Record<TokenType, string> = {
  plain: 'text-slate-100',
  comment: 'text-slate-400 italic',
  string: 'text-emerald-300',
  keyword: 'text-sky-300 font-medium',
  number: 'text-amber-300',
  xmlTag: 'text-sky-300',
  xmlAttr: 'text-emerald-300',
};

export function CodeExplorerView({
  selectedFileId,
  onSelectFile,
}: CodeExplorerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<PrototypeCategory | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PROTOTYPE_FILES.filter((file) => {
      if (activeCategory !== 'all' && file.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        file.path.toLowerCase().includes(q) ||
        file.summary.toLowerCase().includes(q) ||
        file.content.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, activeCategory]);

  const selectedFile = useMemo(() => {
    return (
      PROTOTYPE_FILES.find((f) => f.id === selectedFileId) ??
      filteredFiles[0] ??
      PROTOTYPE_FILES[0]
    );
  }, [selectedFileId, filteredFiles]);

  const totalLines = useMemo(
    () => PROTOTYPE_FILES.reduce((sum, f) => sum + f.lineCount, 0),
    []
  );

  const lines = useMemo(() => selectedFile.content.split('\n'), [selectedFile]);

  const handleCopyFile = async () => {
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopiedId(selectedFile.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Fallback for non-secure clipboard context
      const textarea = document.createElement('textarea');
      textarea.value = selectedFile.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(selectedFile.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)] bg-slate-50">
      {/* Left Sidebar: File Tree */}
      <aside
        aria-label="Cây thư mục mã nguồn"
        className="w-full lg:w-80 xl:w-96 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col"
      >
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-sm font-bold text-slate-900">Cây thư mục nguyên mẫu</h1>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {PROTOTYPE_FILES.length} tệp · {totalLines.toLocaleString('vi-VN')} dòng
            </span>
          </div>

          <div className="relative">
            <label htmlFor="code-search-input" className="sr-only">
              Tìm tệp hoặc ký hiệu trong mã nguồn
            </label>
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="code-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên tệp, SurfaceControl, dHash..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Lọc theo phân hệ"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
          >
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'android-bridge', label: 'Bridge APK' },
                { id: 'magisk-module', label: 'Magisk' },
                { id: 'python-agent', label: 'Agent' },
              ] as const
            ).map((btn) => {
              const active = activeCategory === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActiveCategory(btn.id)}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5 max-h-[340px] lg:max-h-[calc(100vh-14rem)]">
          {filteredFiles.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Không tìm thấy tệp nào khớp &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
              >
                Hiển thị lại toàn bộ mã nguồn
              </button>
            </div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const group = filteredFiles.filter((f) => f.category === category);
              if (group.length === 0) return null;
              const meta = CATEGORY_LABELS[category];
              return (
                <section key={category} aria-label={meta.title}>
                  <div className="px-2 pb-1.5 mb-1 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span>{meta.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{meta.subtitle}</p>
                  </div>
                  <ul className="space-y-0.5">
                    {group.map((file) => {
                      const isSelected = file.id === selectedFile.id;
                      return (
                        <li key={file.id}>
                          <button
                            type="button"
                            onClick={() => onSelectFile(file.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-950 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <FileCode2
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isSelected ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="text-xs font-mono truncate">{file.fileName}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                              {file.lineCount}L
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Main Pane: File Metadata + High-Contrast Code Viewer */}
      <main className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-mono">
              <span>{CATEGORY_LABELS[selectedFile.category].title}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedFile.language}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{selectedFile.lineCount} dòng</span>
              {selectedFile.executable && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-medium">chmod +x (0755)</span>
                </>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-mono break-all">
              {selectedFile.path}
            </h2>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              {selectedFile.summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyFile}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {copiedId === selectedFile.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sao chép tệp</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadSingleFile}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tải tệp</span>
            </button>
          </div>
        </div>

        {/* Code Viewport */}
        <div
          data-testid="code-viewer"
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-[420px]"
        >
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="truncate">{selectedFile.path}</span>
            <span className="shrink-0 tabular-nums">UTF-8 · LF</span>
          </div>
          <div className="flex-1 overflow-auto code-scroll p-4 max-h-[calc(100vh-19rem)]">
            <pre className="text-[13px] leading-6 font-mono text-slate-100">
              <code>
                {lines.map((line, idx) => {
                  const tokens = tokenizeCodeLine(line, selectedFile.language);
                  return (
                    <div key={idx} className="table-row hover:bg-slate-900/70">
                      <span
                        aria-hidden="true"
                        className="table-cell select-none pr-5 text-right text-slate-500 tabular-nums w-12"
                      >
                        {idx + 1}
                      </span>
                      <span className="table-cell whitespace-pre">
                        {tokens.length === 0
                          ? ' '
                          : tokens.map((tok, tIdx) => (
                              <span key={tIdx} className={TOKEN_CLASSES[tok.type]}>
                                {tok.text}
                              </span>
                            ))}
                      </span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
