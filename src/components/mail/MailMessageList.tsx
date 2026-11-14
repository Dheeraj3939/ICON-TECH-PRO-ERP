'use client';

import React from 'react';
import {
  Search,
  Star,
  Paperclip,
  RotateCw,
  Filter,
  CheckSquare,
  Square,
  Inbox,
  Send,
  FileText,
  Archive,
  Trash2,
  Tag,
} from 'lucide-react';
import type { MailMessage, MailFolder } from './mock-mail-data';

interface MailMessageListProps {
  messages: MailMessage[];
  selectedMessageId: string | null;
  activeFolder: MailFolder;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectMessage: (msg: MailMessage) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onRefresh: () => void;
  filterUnreadOnly: boolean;
  onToggleFilterUnread: () => void;
  filterStarredOnly: boolean;
  onToggleFilterStarred: () => void;
}

const FOLDER_TITLES: Record<MailFolder, string> = {
  inbox: 'Inbox',
  starred: 'Starred',
  sent: 'Sent',
  drafts: 'Drafts',
  archive: 'Archive',
  trash: 'Trash',
};

export function MailMessageList({
  messages,
  selectedMessageId,
  activeFolder,
  searchQuery,
  onSearchChange,
  onSelectMessage,
  onToggleStar,
  onRefresh,
  filterUnreadOnly,
  onToggleFilterUnread,
  filterStarredOnly,
  onToggleFilterStarred,
}: MailMessageListProps) {
  const unreadCount = messages.filter((m) => m.isUnread).length;

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 min-w-0">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/50">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail (sender, subject, keyword)..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">
            {FOLDER_TITLES[activeFolder]}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
            {messages.length}
          </span>
          {unreadCount > 0 && activeFolder === 'inbox' && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Filter Unread */}
          <button
            type="button"
            onClick={onToggleFilterUnread}
            className={`px-2 py-1 rounded text-[11px] font-medium transition ${
              filterUnreadOnly
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
            title="Show only unread messages"
          >
            Unread
          </button>

          {/* Filter Starred */}
          <button
            type="button"
            onClick={onToggleFilterStarred}
            className={`p-1 rounded transition ${
              filterStarredOnly
                ? 'text-amber-500 bg-amber-50'
                : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200'
            }`}
            title="Show only starred messages"
          >
            <Star className={`w-3.5 h-3.5 ${filterStarredOnly ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Refresh preview */}
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 hover:bg-slate-200 text-slate-500 rounded transition"
            title="Refresh preview messages"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Message Rows Scrollable Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {messages.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
            <p className="text-xs font-medium text-slate-600">No messages in {FOLDER_TITLES[activeFolder]}</p>
            {searchQuery && (
              <p className="text-[11px] text-slate-400 mt-1">
                No results matching "{searchQuery}"
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = msg.id === selectedMessageId;

            return (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg)}
                className={`p-3 cursor-pointer transition select-none flex items-start gap-2.5 relative ${
                  isSelected
                    ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                    : msg.isUnread
                    ? 'bg-white hover:bg-slate-50 font-medium'
                    : 'bg-slate-50/40 hover:bg-slate-100/70 text-slate-600'
                }`}
              >
                {/* Unread indicator dot */}
                {msg.isUnread && (
                  <div className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                )}

                {/* Star Button */}
                <button
                  type="button"
                  onClick={(e) => onToggleStar(msg.id, e)}
                  className={`mt-0.5 p-0.5 rounded transition ${
                    msg.isStarred
                      ? 'text-amber-500'
                      : 'text-slate-300 hover:text-amber-400'
                  }`}
                  title={msg.isStarred ? 'Unstar' : 'Star'}
                >
                  <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-amber-400' : ''}`} />
                </button>

                {/* Content Box */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      className={`text-xs truncate ${
                        msg.isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                      }`}
                    >
                      {msg.fromName}
                    </span>
                    <span className="text-[11px] text-slate-400 flex-shrink-0 font-mono">
                      {msg.timestamp}
                    </span>
                  </div>

                  <p
                    className={`text-xs truncate leading-snug ${
                      msg.isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {msg.subject}
                  </p>

                  <p className="text-[11px] text-slate-500 truncate leading-relaxed mt-0.5">
                    {msg.preview}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {msg.hasAttachments && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                        <Paperclip className="w-2.5 h-2.5" />
                        <span>Attached</span>
                      </span>
                    )}

                    {msg.tags.slice(0, 2).map((t, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
