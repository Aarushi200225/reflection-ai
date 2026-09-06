import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { JournalInteraction, ChatMessage } from '../types';
import {
  Send,
  Sparkles,
  Mic,
  MicOff,
  CloudCheck,
  CloudUpload,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  MapPin,
} from 'lucide-react';
import { EntryLocationMap } from './EntryLocationMap';

interface ActiveReflectionProps {
  interaction: JournalInteraction;
  onUpdateInteraction: (updated: Partial<JournalInteraction>) => Promise<void>;
  onSendToGemini: (text: string) => Promise<void>;
  onAddLocation: () => Promise<void>;
  isThinking: boolean;
  isSaving: boolean;
  error: string | null;
  onClearError: () => void;
}

const QUICK_PROMPTS = [
  'Deep Work & Focus Audit',
  'Celebrate Today\'s Win',
  'Clarify a Tough Decision',
  'Mindset & Stress Check',
  'Gratitude & Micro-Moments',
];

export const ActiveReflection: React.FC<ActiveReflectionProps> = ({
  interaction,
  onUpdateInteraction,
  onSendToGemini,
  onAddLocation,
  isThinking,
  isSaving,
  error,
  onClearError,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [title, setTitle] = useState(interaction.title || 'New Reflection');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync title with active interaction
  useEffect(() => {
    setTitle(interaction.title || 'New Reflection');
  }, [interaction.id, interaction.title]);

  // Scroll to bottom of message list on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interaction.messages, isThinking]);

  // Voice dictation using Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInputText((prev) => (prev ? `${prev} ${currentTranscript}` : currentTranscript));
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice dictation is not supported in this browser environment.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== interaction.title) {
      onUpdateInteraction({ title: title.trim() });
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isThinking) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    setInputText('');
    await onSendToGemini(textToSend.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-3xl flex flex-col h-full shadow-sm overflow-hidden">
      {/* Reflection Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex-1 mr-4">
          <input
            id="reflection-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Reflection Title..."
            className="text-lg font-bold text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 -mx-1 w-full"
          />
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 px-1">
            <span>Per-User Cloud Firestore Storage</span>
            <span>•</span>
            <span>ABAC Keyed Path</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddLocation}
            title="Attach current location"
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full text-[11px] font-bold transition-all"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{interaction.location ? 'Located' : 'Add location'}</span>
          </button>
          {isSaving ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[11px] font-bold">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Saving</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold">
              <CloudCheck className="w-3.5 h-3.5" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={onClearError}
            className="text-rose-900 font-bold hover:underline ml-2 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Conversation Messages Container */}
      <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-5">
        {interaction.location && (
          <div className="max-w-xs">
            <EntryLocationMap location={interaction.location} />
          </div>
        )}
        {interaction.messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800 mb-1">What's on your mind today?</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Write freely about your day, challenges, ideas, or questions. Gemini will reflect, summarize themes, and help uncover insights.
            </p>

            <div className="w-full text-left">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-indigo-500" />
                <span>Suggested Reflection Starters</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 hover:border-indigo-200 text-xs font-medium rounded-xl transition-all text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          interaction.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-start' : 'justify-end'}`}
              >
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    You
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
                    isUser
                      ? 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-200/80'
                      : 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-200/50'
                  }`}
                >
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>

                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm mt-0.5">
                    G3
                  </div>
                )}
              </div>
            );
          })
        )}

        {isThinking && (
          <div className="flex gap-3 justify-end items-center">
            <div className="bg-indigo-600/90 text-white p-4 rounded-2xl rounded-tr-none shadow-md flex items-center gap-2 text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Gemini is synthesizing your reflection...</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              G3
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex-shrink-0">
        <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
          <textarea
            id="reflection-chat-input"
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your journal thoughts or ask Gemini for reflection... (Enter to send, Shift+Enter for newline)"
            className="flex-grow bg-transparent text-sm text-slate-800 placeholder-slate-400 p-2 resize-none outline-none"
          />

          <div className="flex items-center gap-1.5 pl-2">
            <button
              id="voice-dictation-btn"
              type="button"
              onClick={toggleVoice}
              title={isRecording ? 'Stop Recording' : 'Dictate Reflection'}
              className={`p-2 rounded-xl transition-all ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              id="send-reflection-btn"
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isThinking}
              className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
