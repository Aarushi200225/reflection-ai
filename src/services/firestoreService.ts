import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { JournalInteraction, StreakStats } from '../types';

/**
 * Strict Undefined Stripper
 * Recursively cleans payloads to guarantee no undefined values reach the Firestore SDK.
 */
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizePayload(item)).filter((item) => item !== undefined) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Subscribe to user's isolated interactions in real-time.
 * Path: /users/{userId}/interactions
 */
export function subscribeToUserInteractions(
  userId: string,
  onUpdate: (interactions: JournalInteraction[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const results: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        results.push({
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          messages: Array.isArray(data.messages) ? data.messages : [],
          insights: data.insights || undefined,
          tags: Array.isArray(data.tags) ? data.tags : [],
          mood: data.mood || 'Reflective',
          pinned: Boolean(data.pinned),
          location: data.location || undefined,
        });
      });
      onUpdate(results);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Save or update a user-isolated interaction.
 * Path: /users/{userId}/interactions/{interactionId}
 */
export async function saveUserInteraction(
  userId: string,
  interaction: Partial<JournalInteraction> & { id: string }
): Promise<void> {
  if (!userId) throw new Error('Cannot save interaction without authenticated userId');
  if (!interaction.id) throw new Error('Interaction ID is required');

  const docRef = doc(db, 'users', userId, 'interactions', interaction.id);
  const now = new Date().toISOString();

  const payload: Partial<JournalInteraction> = {
    id: interaction.id,
    userId,
    title: interaction.title || 'New Reflection',
    createdAt: interaction.createdAt || now,
    updatedAt: now,
    messages: interaction.messages || [],
    insights: interaction.insights || undefined,
    tags: interaction.tags || [],
    mood: interaction.mood || 'Reflective',
    pinned: Boolean(interaction.pinned),
    location: interaction.location || undefined,
  };

  const cleanData = sanitizePayload(payload);
  await setDoc(docRef, cleanData, { merge: true });
}

/**
 * Delete a user-isolated interaction.
 */
export async function deleteUserInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) return;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(docRef);
}

/**
 * Calculate user streaks and consistency statistics.
 */
export function computeStreakStats(interactions: JournalInteraction[]): StreakStats {
  if (!interactions || interactions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalEntries: 0,
      thisMonthCount: 0,
      activeDates: [],
      consistencyPercentile: 50,
    };
  }

  const dateSet = new Set<string>();
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  let thisMonthCount = 0;

  interactions.forEach((item) => {
    if (item.createdAt) {
      const dateStr = item.createdAt.slice(0, 10); // 'YYYY-MM-DD'
      dateSet.add(dateStr);
      if (dateStr.startsWith(currentMonthPrefix)) {
        thisMonthCount++;
      }
    }
  });

  const sortedDates = Array.from(dateSet).sort().reverse(); // newest first
  const activeDates = Array.from(dateSet);

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Check if today or yesterday is present to anchor streak
  let checkingDate = new Date();
  if (!dateSet.has(today) && dateSet.has(yesterday)) {
    checkingDate = new Date(Date.now() - 86400000);
  }

  while (true) {
    const formatted = checkingDate.toISOString().slice(0, 10);
    if (dateSet.has(formatted)) {
      currentStreak++;
      checkingDate = new Date(checkingDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let running = 0;
  const chronological = Array.from(dateSet).sort();
  for (let i = 0; i < chronological.length; i++) {
    if (i === 0) {
      running = 1;
    } else {
      const prev = new Date(chronological[i - 1]).getTime();
      const curr = new Date(chronological[i]).getTime();
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        running++;
      } else {
        running = 1;
      }
    }
    if (running > longestStreak) {
      longestStreak = running;
    }
  }

  // Percentile estimate based on streak
  const consistencyPercentile = Math.min(99, Math.max(80, 85 + Math.min(currentStreak * 2, 14)));

  return {
    currentStreak: Math.max(currentStreak, interactions.length > 0 ? 1 : 0),
    longestStreak: Math.max(longestStreak, currentStreak),
    totalEntries: interactions.length,
    thisMonthCount,
    activeDates,
    consistencyPercentile,
  };
}
