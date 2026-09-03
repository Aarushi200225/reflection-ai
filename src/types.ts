export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface ReflectionInsight {
  synthesis: string;
  keyThemes: string[];
  mood: string;
  actionablePrompt?: string;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  messages: ChatMessage[];
  insights?: ReflectionInsight;
  tags?: string[];
  mood?: string;
  pinned?: boolean;
}

export interface WrappedReport {
  periodTitle: string;
  headline: string;
  dominantMood: string;
  topThemes: string[];
  deepInsights: string[];
  mindsetShift: string;
  goldenQuote: string;
  nextPeriodFocus: string;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  thisMonthCount: number;
  activeDates: string[]; // ['YYYY-MM-DD']
  consistencyPercentile: number;
}
