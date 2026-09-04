import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, authedFetch } from './firebase';
import {
  subscribeToUserInteractions,
  saveUserInteraction,
  deleteUserInteraction,
  computeStreakStats,
} from './services/firestoreService';
import { JournalInteraction, ChatMessage, StreakStats } from './types';
import { Navbar } from './components/Navbar';
import { LandingAuth } from './components/LandingAuth';
import { JournalHistory } from './components/JournalHistory';
import { ActiveReflection } from './components/ActiveReflection';
import { GeminiInsights } from './components/GeminiInsights';
import { ConsistencyMindscape } from './components/ConsistencyMindscape';
import { JournalWrappedModal } from './components/JournalWrappedModal';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [activeInteraction, setActiveInteraction] = useState<JournalInteraction | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWrappedOpen, setIsWrappedOpen] = useState(false);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to user-isolated Firestore entries
  useEffect(() => {
    if (!user) {
      setInteractions([]);
      setActiveInteraction(null);
      return;
    }

    const unsubscribe = subscribeToUserInteractions(
      user.uid,
      (fetched) => {
        setInteractions(fetched);

        // Keep active interaction synced or default to the latest
        setActiveInteraction((prev) => {
          if (!prev && fetched.length > 0) {
            return fetched[0];
          }
          if (prev) {
            const found = fetched.find((item) => item.id === prev.id);
            return found || (fetched.length > 0 ? fetched[0] : null);
          }
          return null;
        });
      },
      (err) => {
        console.error('Firestore real-time subscription error:', err);
        setError('Failed to connect to your isolated Firestore data.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Compute habit streaks & heatmap metrics
  const streakStats: StreakStats = React.useMemo(() => {
    return computeStreakStats(interactions);
  }, [interactions]);

  // Create a new reflection session
  const handleNewReflection = async () => {
    if (!user) return;
    const newId = `reflection_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDoc: JournalInteraction = {
      id: newId,
      userId: user.uid,
      title: 'New Reflection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      tags: ['Daily'],
      mood: 'Reflective',
    };

    try {
      setIsSaving(true);
      await saveUserInteraction(user.uid, newDoc);
      setActiveInteraction(newDoc);
    } catch (err: any) {
      console.error('Failed to create new reflection:', err);
      setError('Could not initialize reflection in Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update active interaction properties (e.g. title)
  const handleUpdateInteraction = async (updatedFields: Partial<JournalInteraction>) => {
    if (!user || !activeInteraction) return;
    const updated: JournalInteraction = {
      ...activeInteraction,
      ...updatedFields,
      updatedAt: new Date().toISOString(),
    };

    setActiveInteraction(updated);
    try {
      setIsSaving(true);
      await saveUserInteraction(user.uid, updated);
    } catch (err: any) {
      console.error('Failed to update reflection:', err);
      setError('Failed to sync changes to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete an interaction
  const handleDeleteInteraction = async (interactionId: string) => {
    if (!user) return;
    try {
      await deleteUserInteraction(user.uid, interactionId);
      if (activeInteraction?.id === interactionId) {
        const remaining = interactions.filter((i) => i.id !== interactionId);
        setActiveInteraction(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      console.error('Failed to delete interaction:', err);
      setError('Could not delete interaction from Firestore.');
    }
  };

  // Send message to Gemini and update Firestore
  const handleSendToGemini = async (text: string) => {
    if (!user) return;

    let current = activeInteraction;
    if (!current) {
      // Auto-create an interaction if none is currently selected
      const newId = `reflection_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      current = {
        id: newId,
        userId: user.uid,
        title: text.length > 30 ? `${text.slice(0, 30)}...` : text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        tags: ['Reflection'],
        mood: 'Reflective',
      };
    }

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...current.messages, userMessage];
    
    // Auto-derive a better title if default
    let updatedTitle = current.title;
    if (current.title === 'New Reflection' && current.messages.length === 0) {
      updatedTitle = text.length > 35 ? `${text.slice(0, 35)}...` : text;
    }

    const optimisticDoc: JournalInteraction = {
      ...current,
      title: updatedTitle,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    setActiveInteraction(optimisticDoc);
    setIsThinking(true);
    setError(null);

    try {
      // 1. Persist user message first
      setIsSaving(true);
      await saveUserInteraction(user.uid, optimisticDoc);
      setIsSaving(false);

      // 2. Prepare past context from other interactions (strictly isolated to this user)
      const pastContext = interactions
        .filter((item) => item.id !== optimisticDoc.id)
        .slice(0, 5)
        .map((item) => ({
          date: item.createdAt.slice(0, 10),
          title: item.title,
          summary: item.insights?.synthesis || item.messages?.[0]?.content?.slice(0, 150) || '',
          themes: item.insights?.keyThemes || item.tags || [],
          preview: item.messages?.[0]?.content?.slice(0, 200) || '',
        }));

      // 3. Call server-side Gemini reflection endpoint with token attached
      const response = await authedFetch('/api/gemini/reflect', {
        messages: updatedMessages,
        currentEntry: text,
        journalContext: pastContext,
        currentThemes: optimisticDoc.tags || [],
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gemini reflection request failed.');
      }

      const reflectionData = result.data;
      const modelMessage: ChatMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        content: reflectionData.reflection || result.text || 'I have reflected on your entry.',
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, modelMessage];
      const finalDoc: JournalInteraction = {
        ...optimisticDoc,
        messages: finalMessages,
        insights: {
          synthesis: reflectionData.synthesis || 'Daily reflection completed.',
          keyThemes: Array.isArray(reflectionData.keyThemes) ? reflectionData.keyThemes : ['Reflection'],
          mood: reflectionData.mood || 'Reflective',
          actionablePrompt: reflectionData.actionablePrompt || undefined,
        },
        tags: Array.isArray(reflectionData.keyThemes) && reflectionData.keyThemes.length > 0
          ? reflectionData.keyThemes
          : optimisticDoc.tags,
        mood: reflectionData.mood || optimisticDoc.mood,
        updatedAt: new Date().toISOString(),
      };

      setActiveInteraction(finalDoc);

      // 4. Persist Gemini response & synthesis
      setIsSaving(true);
      await saveUserInteraction(user.uid, finalDoc);
    } catch (err: any) {
      console.error('Error in Gemini reflection process:', err);
      setError(err?.message || 'Gemini encountered a temporary issue. Please try again.');
    } finally {
      setIsThinking(false);
      setIsSaving(false);
    }
  };

  // Loading spinner during auth check
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-slate-900">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700">Verifying secure session...</p>
        <p className="text-xs text-slate-400 mt-1">Firebase Authentication</p>
      </div>
    );
  }

  // If user is not logged in, render the Bento Landing & Sign In page
  if (!user) {
    return <LandingAuth />;
  }

  // Ensure an active interaction is selected if available or generate dummy placeholder
  const activeOrPlaceholder: JournalInteraction = activeInteraction || {
    id: 'placeholder',
    userId: user.uid,
    title: 'New Reflection',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    tags: ['Daily'],
    mood: 'Reflective',
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onOpenWrapped={() => setIsWrappedOpen(true)}
        entriesCount={interactions.length}
      />

      {/* Main Bento Grid Container */}
      <main className="flex-grow p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-6 gap-4 overflow-y-auto lg:overflow-hidden">
        {/* Bento Column 1: Journal History (col-span-3 row-span-6) */}
        <div className="lg:col-span-3 lg:row-span-6 h-[380px] lg:h-full">
          <JournalHistory
            interactions={interactions}
            activeId={activeInteraction?.id || null}
            onSelect={(item) => setActiveInteraction(item)}
            onNew={handleNewReflection}
            onDelete={handleDeleteInteraction}
          />
        </div>

        {/* Bento Column 2: Active Reflection Canvas (col-span-6 row-span-6) */}
        <div className="lg:col-span-6 lg:row-span-6 h-[550px] lg:h-full">
          <ActiveReflection
            interaction={activeOrPlaceholder}
            onUpdateInteraction={handleUpdateInteraction}
            onSendToGemini={handleSendToGemini}
            isThinking={isThinking}
            isSaving={isSaving}
            error={error}
            onClearError={() => setError(null)}
          />
        </div>

        {/* Bento Column 3 Top: Gemini Insights (col-span-3 row-span-4) */}
        <div className="lg:col-span-3 lg:row-span-4 h-[320px] lg:h-full">
          <GeminiInsights
            insights={activeOrPlaceholder.insights}
            isThinking={isThinking}
          />
        </div>

        {/* Bento Column 3 Bottom: Consistency Mindscape (col-span-3 row-span-2) */}
        <div className="lg:col-span-3 lg:row-span-2 h-[220px] lg:h-full">
          <ConsistencyMindscape stats={streakStats} />
        </div>
      </main>

      {/* Journal Wrapped Modal */}
      <JournalWrappedModal
        isOpen={isWrappedOpen}
        onClose={() => setIsWrappedOpen(false)}
        interactions={interactions}
      />
    </div>
  );
}
