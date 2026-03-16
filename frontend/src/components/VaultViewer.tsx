import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface VaultViewerProps {
  filename: string;
}

export const VaultViewer: React.FC<VaultViewerProps> = ({ filename }) => {
  const navigate = useNavigate();
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) return;

    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8000/vault/files/${encodeURIComponent(filename)}`);
        if (!response.ok) throw new Error('Failed to load file');
        const data = await response.json();
        setFileContent(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [filename]);

  return (
    <div className="h-screen w-screen bg-[#070707] text-gray-200 flex flex-col p-6 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-[#262626] pb-4">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/5 rounded-lg transition-all text-blue-400"
          >
            <ChevronLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-[11px] font-bold text-gray-400 tracking-[0.2em] uppercase">VAULT VIEWER</h1>
            <p className="text-[9px] text-gray-600 mt-1 font-mono">{filename}</p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-[#141414] border border-[#262626] rounded-xl overflow-hidden flex flex-col shadow-2xl">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-blue-400 text-3xl mb-4">⟳</div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Loading file...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-red-400 mb-2">✗ Error Loading File</p>
              <p className="text-[9px] text-gray-500">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-[#0d0d0d]/50 p-6 overflow-y-auto">
            <div className="prose prose-invert max-w-none">
              <div className="space-y-4">
                {fileContent.split('\n').map((line, i) => (
                  <div key={i} className="space-y-1">
                    {line.startsWith('# ') ? (
                      <h1 className="text-lg font-bold text-blue-400">{line.substring(2)}</h1>
                    ) : line.startsWith('## ') ? (
                      <h2 className="text-base font-bold text-blue-300 mt-4">{line.substring(3)}</h2>
                    ) : line.startsWith('### ') ? (
                      <h3 className="text-sm font-bold text-blue-200 mt-2">{line.substring(4)}</h3>
                    ) : line.startsWith('- ') || line.startsWith('* ') ? (
                      <div className="text-xs text-gray-300 pl-4">
                        • {line.substring(2)}
                      </div>
                    ) : line.startsWith('---') ? (
                      <div className="border-t border-[#262626] my-4" />
                    ) : line.trim() ? (
                      <p className="text-xs leading-relaxed text-gray-400 font-mono">{line}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
