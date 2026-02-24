import type { Chat } from './ChatContainer';
import { t } from './theme';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  darkMode: boolean;
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar({ chats, activeChatId, onSelect, onNew, darkMode: _ }: SidebarProps) {
  return (
    <div className={`flex flex-col w-56 flex-shrink-0 h-screen ${t.panelBg} border-r ${t.border}`}>
      {/* New chat button */}
      <div className={`p-3 border-b ${t.border}`}>
        <button
          onClick={onNew}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${t.textSecondary} ${t.hover} transition`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-2">
        {chats.length === 0 ? (
          <p className={`text-xs ${t.textFaint} px-4 py-3`}>No chats yet</p>
        ) : (
          chats
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(chat => (
              <button
                key={chat.id}
                onClick={() => onSelect(chat.id)}
                className={`w-full text-left px-3 py-2.5 transition ${
                  chat.id === activeChatId
                    ? `${t.pageBg} border-r-2 border-blue-500`
                    : t.hover
                }`}
              >
                <p className={`text-sm truncate font-medium ${
                  chat.id === activeChatId
                    ? 'text-blue-700 dark:text-blue-300'
                    : t.textPrimary
                }`}>
                  {chat.title || 'New chat'}
                </p>
                <p className={`text-xs ${t.textFaint} mt-0.5`}>
                  {relativeDate(chat.createdAt)}
                </p>
              </button>
            ))
        )}
      </div>
    </div>
  );
}
