import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParticleWave } from './ParticleWave';

interface VoiceVisualizerProps {
  isActive: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive }) => {
  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Dynamic Glow Layers (Updated to Cyan/Blue) */}
      <motion.div 
        animate={{ 
          scale: isActive ? [1, 1.2, 1] : 1,
          opacity: isActive ? [0.3, 0.5, 0.3] : 0.2
        }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute inset-0 bg-cyan-600/20 rounded-full blur-[80px]"
      />
      <motion.div 
        animate={{ 
          scale: isActive ? [1, 1.1, 1] : 1,
          opacity: isActive ? [0.4, 0.6, 0.4] : 0.25
        }}
        transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
        className="absolute inset-10 bg-blue-600/10 rounded-full blur-[60px]"
      />
      
      {/* The Central Sphere */}
      <div className="relative w-64 h-64 rounded-full overflow-hidden border border-white/5 bg-gradient-to-b from-[#0a0a0a] to-black flex items-center justify-center shadow-[0_0_80px_rgba(0,0,0,1)]">
        {/* Animated Grid / Pattern inside */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
        
        {/* Particle Wave Visualization */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key="particle-wave-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-40 flex items-center justify-center"
            >
              <ParticleWave isActive={isActive} />
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Glass Reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
        <div className="absolute top-4 left-1/4 w-1/2 h-1/4 bg-white/5 rounded-[100%] blur-xl pointer-events-none" />
      </div>
    </div>
  );
};
