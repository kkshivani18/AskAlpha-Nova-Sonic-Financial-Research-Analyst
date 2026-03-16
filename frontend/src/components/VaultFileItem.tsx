import React from 'react';
import { File, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface VaultFileItemProps {
  filename: string;
  modified: number;
  onClick: () => void;
}

export const VaultFileItem: React.FC<VaultFileItemProps> = ({ filename, modified, onClick }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ x: 4 }}
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer transition-all group"
  >
    <File size={14} className="text-blue-400/60 group-hover:text-blue-400 transition-colors" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-mono text-gray-300 truncate group-hover:text-blue-200">{filename}</p>
      <div className="flex items-center gap-1 mt-1 text-[8px] text-gray-500">
        <Clock size={10} />
        <span>{new Date(modified * 1000).toLocaleDateString()}</span>
      </div>
    </div>
    <div className="text-gray-600 group-hover:text-blue-500 transition-colors">→</div>
  </motion.div>
);
