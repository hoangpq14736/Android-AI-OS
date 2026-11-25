/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { CodeExplorerView } from './components/CodeExplorerView';
import { PermissionAuditorView } from './components/PermissionAuditorView';
import { AgentSimulatorView } from './components/AgentSimulatorView';
import { BuildFlashGuideView } from './components/BuildFlashGuideView';
import { PROTOTYPE_FILES } from './data/prototypeFiles';
import { buildZipArchive } from './utils/zipBuilder';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('code');
  const [selectedFileId, setSelectedFileId] = useState<string>(PROTOTYPE_FILES[0].id);
  const [downloading, setDownloading] = useState(false);

  const handleOpenFile = (fileId: string) => {
    setSelectedFileId(fileId);
    setActiveTab('code');
  };

  const handleDownloadZip = () => {
    setDownloading(true);
    try {
      const zipBytes = buildZipArchive(
        PROTOTYPE_FILES.map((file) => ({
          path: `android-ai-os-prototype/${file.path}`,
          content: file.content,
          executable: file.executable,
        }))
      );
      const blob = new Blob([zipBytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'android-ai-os-prototype.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      window.setTimeout(() => setDownloading(false), 300);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onDownloadZip={handleDownloadZip}
        downloading={downloading}
      />

      <div className="flex-1">
        {activeTab === 'code' && (
          <CodeExplorerView
            selectedFileId={selectedFileId}
            onSelectFile={setSelectedFileId}
          />
        )}
        {activeTab === 'audit' && (
          <PermissionAuditorView onOpenFile={handleOpenFile} />
        )}
        {activeTab === 'simulator' && <AgentSimulatorView />}
        {activeTab === 'deploy' && <BuildFlashGuideView />}
      </div>
    </div>
  );
}
