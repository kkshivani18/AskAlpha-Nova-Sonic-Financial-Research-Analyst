import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageBubbleProps {
  text: string;
  isUser: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ text, isUser }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "mb-4 p-3 rounded-lg border border-dashed text-sm leading-relaxed",
      isUser 
        ? "border-blue-500/30 bg-blue-500/5 ml-8 text-blue-100/90" 
        : "border-gray-700 bg-gray-800/20 mr-8 text-gray-300"
    )}
  >
    {text}
  </motion.div>
);
