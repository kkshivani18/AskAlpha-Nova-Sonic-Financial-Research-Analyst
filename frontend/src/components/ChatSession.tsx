import React, { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Panel } from './Panel';
import { MessageBubble } from './MessageBubble';

interface Message {
  text: string;
  isUser: boolean;
}

interface ChatSessionProps {
  messages: Message[];
}

export const ChatSession: React.FC<ChatSessionProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-80 flex flex-col gap-6">
      <Panel title="Chat Session" icon={MessageSquare} className="flex-1">
        <div className="space-y-4 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto flex flex-col gap-4">
            {messages.map((m, i) => (
              <MessageBubble key={i} text={m.text} isUser={m.isUser} />
            ))}
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
                <MessageSquare size={40} className="mb-4" />
                <p className="text-xs uppercase tracking-widest font-bold">Encrypted Link Idle</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </Panel>
    </div>
  );
};
