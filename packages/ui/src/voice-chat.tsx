'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { getApiBase, getAuthHeaders } from './config';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// Check browser support
const SpeechRecognition = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export default function VoiceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const wakeLockRef = useRef<any>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Wake Lock — keep screen on while listening or speaking (AirPods/pocket use)
  useEffect(() => {
    const active = isListening || isSpeaking || isThinking;
    if (active && 'wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen')
        .then((lock: any) => { wakeLockRef.current = lock; })
        .catch(() => {});
    } else if (!active && wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, [isListening, isSpeaking, isThinking]);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { role: 'user', text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setTextInput('');
    setTranscript('');

    try {
      const res = await fetch('/api/kernal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();
      const reply = data.reply || data.response || data.error || 'No response';

      const assistantMsg: Message = { role: 'assistant', text: reply, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
      speak(reply);
    } catch {
      const errorMsg: Message = { role: 'assistant', text: 'Failed to reach Blekkie. Check API connection.', timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  }, [speak]);

  const toggleListening = useCallback(() => {
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser. Use Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcript.trim()) {
        sendMessage(transcript);
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
  }, [isListening, transcript, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(textInput);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-teal-500 animate-pulse' : isThinking ? 'bg-amber-500 animate-pulse' : 'bg-stone-300'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Blekkie</span>
        </div>
        {isSpeaking && (
          <button
            onClick={() => synthRef.current?.cancel()}
            className="text-[10px] text-stone-400 hover:text-stone-600"
          >
            Stop speaking
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-stone-400 text-center mt-8">
            Ask anything about your knowledge graph
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
              msg.role === 'user'
                ? 'bg-teal-50 text-teal-900'
                : 'bg-stone-50 text-stone-700'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-stone-50 rounded-lg px-3 py-1.5 text-sm text-stone-400">
              Thinking...
            </div>
          </div>
        )}
        {isListening && transcript && (
          <div className="flex justify-end">
            <div className="bg-teal-50/50 rounded-lg px-3 py-1.5 text-sm text-teal-600 italic">
              {transcript}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-stone-100">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your knowledge graph..."
          className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        <button
          onClick={() => sendMessage(textInput)}
          disabled={isThinking || !textInput.trim()}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
