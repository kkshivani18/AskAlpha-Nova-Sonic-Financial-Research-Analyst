import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, MessageSquare, Database, Activity, Send, Terminal, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// modular components
import { Panel } from './components/Panel';
import { MessageBubble } from './components/MessageBubble';
import { VaultFileItem } from './components/VaultFileItem';
import { FormattedResult } from './components/FormattedResult';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { VaultViewer } from './components/VaultViewer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/vault/:filename" element={<VaultViewerPage />} />
      </Routes>
    </Router>
  );
}

function VaultViewerPage() {
  const actualFilename = window.location.pathname.split('/vault/')[1];
  const decodedFilename = actualFilename ? decodeURIComponent(actualFilename) : '';
  return <VaultViewer filename={decodedFilename} />;
}

function MainApp() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<{text: string, isUser: boolean}[]>([]);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [lastToolName, setLastToolName] = useState<string>('');
  const [transcript, setTranscript] = useState("");
  const [vaultFiles, setVaultFiles] = useState<{ filename: string; modified: number; size: number }[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [logs, setLogs] = useState<{text: string, type: 'info' | 'tool' | 'error'}[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const transcriptRef = useRef<string>("");
  const userTranscriptRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch vault files
  const fetchVaultFiles = useCallback(async () => {
    setVaultLoading(true);
    try {
      const response = await fetch('http://localhost:8000/vault/files');
      if (!response.ok) throw new Error('Failed to fetch vault files');
      const data = await response.json();
      setVaultFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching vault files:', err);
    } finally {
      setVaultLoading(false);
    }
  }, []);

  const handleVaultFileClick = (filename: string) => {
    navigate(`/vault/${encodeURIComponent(filename)}`);
  };

  useEffect(() => {
    fetchVaultFiles();
  }, [fetchVaultFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initAudio = async () => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await ctx.resume();
      audioContextRef.current = ctx;
    } else if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/voice`;
    let reconnectAttempt = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (socketRef.current && 
          (socketRef.current.readyState === WebSocket.OPEN || 
           socketRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      
      try {
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          reconnectAttempt = 0;
        };

        ws.onmessage = async (event) => {
          if (event.data instanceof ArrayBuffer) {
            playAudioChunk(event.data);
          } else {
            try {
              const data = JSON.parse(event.data);
              handleMetadata(data);
            } catch (e) {
              console.error('[WS] JSON parse error', e);
            }
          }
        };

        ws.onclose = () => {
          if (reconnectAttempt < maxReconnectAttempts) {
            reconnectAttempt++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 10000);
            reconnectTimeout = setTimeout(connect, delay);
          }
        };

        ws.onerror = (event) => {
          console.error('[WS] Connection error:', event);
        };

        socketRef.current = ws;
      } catch (err) {
        console.error('[WS] Failed to create WebSocket:', err);
      }
    };

    connect();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleMetadata = useCallback((data: any) => {
    switch (data.type) {
      case 'user_transcript':
        userTranscriptRef.current += data.text;
        setTranscript(userTranscriptRef.current);
        break;

      case 'transcript':
        transcriptRef.current += data.text;
        setTranscript(transcriptRef.current);
        break;

      case 'response_complete': {
        const userText = userTranscriptRef.current.trim();
        const assistantText = transcriptRef.current.trim();
        setMessages(prev => {
          const next = [...prev];
          if (userText) next.push({ text: userText, isUser: true });
          if (assistantText) next.push({ text: assistantText, isUser: false });
          return next;
        });
        userTranscriptRef.current = "";
        transcriptRef.current = "";
        setTranscript("");
        break;
      }

      case 'tool_result':
        setLastToolName(data.tool_name.toUpperCase());
        setQueryResult(data.result);
        break;

      default:
        break;
    }
  }, []);

  const nextPlayTimeRef = useRef<number>(0);

  const playAudioChunk = useCallback((buffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    if (buffer.byteLength === 0) return;

    try {
      const ctx = audioContextRef.current;
      const pcm16 = new Int16Array(buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      source.start(startAt);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;
    } catch (err) {
      console.error('[AUDIO] Error playing audio chunk:', err);
    }
  }, []);

  const startRecording = async () => {
    await initAudio();
    transcriptRef.current = "";
    userTranscriptRef.current = "";
    setTranscript("Listening...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        }
      });
      mediaStreamRef.current = stream;

      captureContextRef.current = new AudioContext({ sampleRate: 16000 });
      await captureContextRef.current.resume();
      const source = captureContextRef.current.createMediaStreamSource(stream);

      try {
        await captureContextRef.current.audioWorklet.addModule('/audio-processor.js');
      } catch (workletErr) {
        const workletMsg = workletErr instanceof Error ? workletErr.message : String(workletErr);
        throw new Error(`AudioWorklet initialization failed: ${workletMsg}`);
      }

      const workletNode = new AudioWorkletNode(captureContextRef.current, 'audio-processor');
      let frameCount = 0;

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio_chunk') {
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          try {
            socketRef.current.send(event.data.data);
            frameCount++;
          } catch (err) {
            console.error('Error sending audio chunk:', err);
          }
        }
      };

      source.connect(workletNode);
      workletNode.connect(captureContextRef.current.destination);
      processorRef.current = workletNode;

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ type: 'startAudio' }));
        } catch (err) {
          console.error('[AUDIO] Failed to send startAudio message:', err);
        }
      }

      setIsRecording(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Microphone access error:", err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (captureContextRef.current) {
        await captureContextRef.current.close();
        captureContextRef.current = null;
      }

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ type: "endAudio" }));
        } catch (err) {
          console.error('Error sending endAudio signal:', err);
        }
      }

      setIsRecording(false);
      setTranscript("Processing...");
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#070707] text-gray-200 flex p-6 gap-6 font-sans overflow-hidden">
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

      <div className="flex-1 flex flex-col gap-6">
        <div className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-3xl flex flex-col items-center justify-center relative shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 pointer-events-none opacity-20" />

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
                    userTranscriptRef.current && !transcriptRef.current
                      ? "bg-blue-500/10 border-blue-500/20"
                      : "bg-purple-500/10 border-purple-500/20"
                  )}
                >
                  <p className={cn(
                    "font-mono text-sm uppercase tracking-wider",
                    userTranscriptRef.current && !transcriptRef.current
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
            onClick={isRecording ? () => { stopRecording(); } : startRecording}
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

      <div className="w-80 flex flex-col gap-6">
        <Panel title="Vault Files" icon={Database} className="h-1/2" rightSlot={
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchVaultFiles}
            disabled={vaultLoading}
            className="p-1 hover:bg-white/5 rounded-lg transition-all text-blue-500 hover:text-blue-400 disabled:opacity-50"
            title="Refresh vault files"
          >
            <RefreshCw size={14} className={vaultLoading ? 'animate-spin' : ''} />
          </motion.button>
        }>
          <div className="space-y-2 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
              {vaultLoading ? (
                <div className="flex items-center justify-center h-full opacity-50">
                  <div className="animate-spin">⟳</div>
                  <p className="text-[10px] ml-2">Loading files...</p>
                </div>
              ) : vaultFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold">No Files</p>
                </div>
              ) : (
                vaultFiles.map((file, i) => (
                  <VaultFileItem
                    key={i}
                    filename={file.filename}
                    modified={file.modified}
                    onClick={() => handleVaultFileClick(file.filename)}
                  />
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Query Stream" icon={Activity} className="h-1/2">
          {queryResult ? (
            <FormattedResult data={queryResult} toolName={lastToolName} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
              <Activity size={40} className="mb-3 animate-pulse" />
              <p className="text-[10px] uppercase tracking-widest font-bold">No Data Flow</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
