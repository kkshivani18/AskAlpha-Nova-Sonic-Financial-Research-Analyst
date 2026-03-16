import React from 'react';
import { Mic, MicOff, Terminal, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VoiceVisualizer } from './VoiceVisualizer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoiceInterfaceProps {
  isRecording: boolean;
  transcript: string;
  userTranscript: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  isRecording,
  transcript,
  userTranscript,
  onStartRecording,
  onStopRecording,
}) => {
  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-3xl flex flex-col items-center justify-center relative shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
        {/* Subtle Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

        <VoiceVisualizer isActive={isRecording} />

        <div className="mt-12 text-center px-12 max-w-xl">
          <AnimatePresence mode="wait">
            {transcript && transcript !== "Listening..." ? (
              <motion.div
                key="transcript"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "px-6 py-3 rounded-full backdrop-blur-md border",
                  userTranscript && !transcript.includes('Listening')
                    ? "bg-blue-500/10 border-blue-500/20"
                    : "bg-purple-500/10 border-purple-500/20"
                )}
              >
                <p className={cn(
                  "font-mono text-sm uppercase tracking-wider",
                  userTranscript && !transcript.includes('Listening')
                    ? "text-blue-400"
                    : "text-purple-400"
                )}>
                  {transcript}
                </p>
              </motion.div>
            ) : transcript === "Listening..." ? (
              <motion.div
                key="listening"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-blue-500/10 border border-blue-500/20 px-6 py-3 rounded-full backdrop-blur-md"
              >
                <p className="text-blue-400 font-mono text-sm uppercase tracking-wider animate-pulse">
                  Listening for your question...
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gray-400">System Ready</p>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(59, 130, 246, 0.4)" }}
          whileTap={{ scale: 0.95 }}
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={cn(
            "mt-16 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 border-2",
            isRecording
              ? "bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
              : "bg-blue-600 border-blue-400 text-white shadow-[0_0_40px_rgba(37,99,235,0.3)]"
          )}
        >
          {isRecording ? <MicOff size={36} /> : <Mic size={36} />}
        </motion.button>
      </div>

      {/* Input fallback */}
      <div className="h-16 bg-[#111] border border-[#1a1a1a] rounded-2xl flex items-center px-6 gap-4 shadow-xl group">
        <Terminal size={18} className="text-blue-500/50 group-focus-within:text-blue-400 transition-colors" />
        <input
          type="text"
          placeholder="AWAITING INPUT COMMAND..."
          className="bg-transparent flex-1 border-none focus:outline-none text-[11px] font-mono tracking-widest text-gray-400 placeholder:text-gray-700"
        />
        <button className="p-2 hover:bg-white/5 rounded-xl transition-all text-blue-500 hover:text-blue-400">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
