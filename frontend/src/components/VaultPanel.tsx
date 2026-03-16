import React from 'react';
import { Database, File } from 'lucide-react';
import { Panel } from './Panel';
import { VaultFileItem } from './VaultFileItem';

interface VaultFile {
  filename: string;
  modified: number;
  size: number;
}

interface VaultPanelProps {
  vaultFiles: VaultFile[];
  loading: boolean;
  onFileClick: (filename: string) => void;
}

export const VaultPanel: React.FC<VaultPanelProps> = ({ vaultFiles, loading, onFileClick }) => {
  return (
    <Panel title="Vault Files" icon={Database} className="h-1/2">
      <div className="space-y-2 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center justify-center h-full opacity-50">
              <div className="animate-spin">⟳</div>
              <p className="text-[10px] ml-2">Loading files...</p>
            </div>
          ) : vaultFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
              <File size={32} className="mb-3" />
              <p className="text-[10px] uppercase tracking-widest font-bold">No Files</p>
            </div>
          ) : (
            vaultFiles.map((file, i) => (
              <VaultFileItem
                key={i}
                filename={file.filename}
                modified={file.modified}
                onClick={() => onFileClick(file.filename)}
              />
            ))
          )}
        </div>
      </div>
    </Panel>
  );
};
