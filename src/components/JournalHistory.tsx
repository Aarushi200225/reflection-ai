import React, { useState } from 'react';
import { JournalInteraction } from '../types';
import { Plus, Search, Trash2, Pin, Calendar, Sparkles } from 'lucide-react';

interface JournalHistoryProps {
  interactions: JournalInteraction[];
  activeId: string | null;
  onSelect: (interaction: JournalInteraction) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin?: (interaction: JournalInteraction) => void;
}

export const JournalHistory: React.FC<JournalHistoryProps> = ({
  interactions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onTogglePin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = interactions.filter((item) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = (item.title || '').toLowerCase().includes(q);
    const tagsMatch = item.tags?.some((t) => t.toLowerCase().includes(q));
    const contentMatch = item.messages?.some((m) => m.content.toLowerCase().includes(q));
    return titleMatch || tagsMatch || contentMatch;
  });

  // Group entries helper
  const formatDateLabel = (isoDate: string) => {
    if (!isoDate) return 'Past';
    const d = new Date(isoDate);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isToday) {
      return `Today • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isYesterday) {
      return `Yesterday • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span>Journal History</span>
        </h3>
        <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
          {interactions.length}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        <input
          id="search-journal-history"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reflections..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        />
      </div>

      {/* Entries List */}
      <div className="flex-grow flex flex-col gap-2.5 overflow-y-auto pr-1 min-h-[200px]">
        {filtered.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <Sparkles className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-xs font-medium">No reflections found</p>
            <p className="text-[11px] text-slate-400 mt-1">Start your first reflection below</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isActive = item.id === activeId;
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className={`group p-3 rounded-2xl cursor-pointer transition-all border text-left relative ${
                  isActive
                    ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                    : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[11px] font-semibold ${
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    {formatDateLabel(item.createdAt)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onTogglePin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(item);
                        }}
                        title={item.pinned ? 'Unpin' : 'Pin'}
                        className="p-1 hover:text-indigo-600 text-slate-400 rounded transition-colors"
                      >
                        <Pin className={`w-3 h-3 ${item.pinned ? 'fill-indigo-600 text-indigo-600' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this reflection entry?')) {
                          onDelete(item.id);
                        }
                      }}
                      title="Delete reflection"
                      className="p-1 hover:text-rose-600 text-slate-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p
                  className={`text-sm font-bold truncate ${
                    isActive ? 'text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {item.title || 'Untitled Reflection'}
                </p>

                {item.insights?.synthesis && (
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                    {item.insights.synthesis}
                  </p>
                )}

                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.tags.slice(0, 2).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Reflection Button */}
      <button
        id="new-reflection-btn"
        onClick={onNew}
        className="mt-3 w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-2xl text-sm font-bold shadow-md shadow-slate-200 flex items-center justify-center gap-2 transition-all"
      >
        <Plus className="w-4 h-4" />
        <span>New Reflection</span>
      </button>
    </aside>
  );
};
