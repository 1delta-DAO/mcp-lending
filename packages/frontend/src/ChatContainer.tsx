import React from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useConnection } from 'wagmi';
import { WalletButton } from './WalletButton';
import { TxExecutor, type TxStep } from './TxExecutor';
import { Sidebar } from './Sidebar';
import { t } from './theme';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  transactions?: TxStep[];
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const STORAGE_KEY = 'mcp-chats';

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Chat[];
    // Revive Date objects on messages
    return parsed.map(chat => ({
      ...chat,
      messages: chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

function saveChats(chats: Chat[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function newChatId(): string {
  return Date.now().toString();
}

export default function ChatContainer() {
  const [chats, setChats] = React.useState<Chat[]>(() => {
    const stored = loadChats();
    if (stored.length > 0) return stored;
    const id = newChatId();
    return [{ id, title: '', messages: [], createdAt: Date.now() }];
  });
  const [activeChatId, setActiveChatId] = React.useState<string>(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored[stored.length - 1].id : chats[0]?.id ?? newChatId();
  });
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [selectedProvider, setSelectedProvider] = React.useState<string>(
    () => localStorage.getItem('selectedProvider') ?? 'anthropic'
  );
  const [availableProviders, setAvailableProviders] = React.useState<{ id: string; company: string; model: string }[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { address } = useConnection();
  const clientUrl = import.meta.env.VITE_CLIENT_URL ?? 'http://localhost:3001';

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages ?? [];

  // Persist chats whenever they change
  React.useEffect(() => {
    saveChats(chats);
  }, [chats]);

  React.useEffect(() => {
    axios.get<{ id: string; company: string; model: string }[]>(`${clientUrl}/providers`)
      .then(({ data }) => {
        setAvailableProviders(data);
        setSelectedProvider(prev => {
          const ids = data.map(p => p.id);
          const next = ids.includes(prev) ? prev : ids[0];
          localStorage.setItem('selectedProvider', next);
          return next;
        });
      })
      .catch(() => {});
  }, [clientUrl]);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewChat = () => {
    const id = newChatId();
    setChats(prev => [...prev, { id, title: '', messages: [], createdAt: Date.now() }]);
    setActiveChatId(id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    // Add user message and auto-title on first message
    setChats(prev => prev.map(chat => {
      if (chat.id !== activeChatId) return chat;
      const isFirst = chat.messages.length === 0;
      return {
        ...chat,
        title: isFirst ? input.slice(0, 40) : chat.title,
        messages: [...chat.messages, userMessage],
      };
    }));

    setInput('');
    setIsLoading(true);

    try {
      const { data } = await axios.post<{ response: string; transactions?: TxStep[] }>(
        `${clientUrl}/chat`,
        { query: input, userAddress: address, provider: selectedProvider }
      );

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: data.response,
        timestamp: new Date(),
        transactions: data.transactions,
      };

      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, agentMessage] }
          : chat
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: 'Error: could not reach the agent. Is the client server running?',
        timestamp: new Date(),
      };
      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, errMessage] }
          : chat
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-row h-screen ${t.pageBg}`}>
      {/* Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
        onNew={handleNewChat}
        darkMode={darkMode}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className={`${t.panelBg} border-b ${t.border} px-6 py-4 shadow-sm flex items-center justify-between`}>
          <div>
            <h1 className={`text-2xl font-bold ${t.textPrimary}`}>Lending Agent</h1>
            <p className={`text-sm ${t.textSecondary} mt-1`}>AI-powered lending platform assistant</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>by 1delta</p>
          </div>
          <div className="flex items-center gap-3">
            {availableProviders.length > 0 && (
              <select
                value={selectedProvider}
                onChange={e => {
                  setSelectedProvider(e.target.value);
                  localStorage.setItem('selectedProvider', e.target.value);
                }}
                className={`text-xs px-2 py-1.5 rounded-lg border ${t.borderSm} ${t.cardBg} ${t.textSecondary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                {availableProviders.map(p => (
                  <option key={p.id} value={p.id}>{p.company} — {p.model}</option>
                ))}
              </select>
            )}
            <WalletButton />
            <button
              onClick={() => setDarkMode(d => !d)}
              className={`p-2 rounded-lg ${t.textSecondary} ${t.hover} transition`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.07-.71.71M6.34 17.66l-.71.71m12.73 0-.71-.71M6.34 6.34l-.71-.71M12 5a7 7 0 100 14A7 7 0 0012 5z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className={`flex-1 overflow-y-auto themed-scrollbar ${t.pageBg} ${messages.length === 0 ? 'flex items-center justify-center' : 'p-6 space-y-4'}`}>
          {messages.length === 0 ? (
            <div className={`text-center ${t.textMuted}`}>
              <p className="text-lg font-medium">Welcome to Lending Agent</p>
              <p className="text-sm mt-2">Start by asking about lending markets, positions, or actions</p>
              {!address && (
                <p className="text-xs mt-3 text-blue-600 dark:text-blue-400">
                  Connect your wallet to query your positions automatically
                </p>
              )}
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'max-w-xs lg:max-w-md bg-blue-600 text-white rounded-br-none'
                      : `max-w-xl lg:max-w-2xl ${t.cardBg} ${t.textPrimary} rounded-bl-none`
                  }`}
                >
                  {message.type === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 [overflow-wrap:anywhere]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      {message.transactions && message.transactions.length > 0 && (
                        <TxExecutor steps={message.transactions} />
                      )}
                    </div>
                  )}
                  <span className={`text-xs mt-2 block ${message.type === 'user' ? 'text-blue-100' : t.textMuted}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className={`${t.cardBg} ${t.textPrimary} px-4 py-3 rounded-lg rounded-bl-none`}>
                <div className="flex space-x-2">
                  <div className={`w-2 h-2 ${t.mutedBg} rounded-full animate-bounce`}></div>
                  <div className={`w-2 h-2 ${t.mutedBg} rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }}></div>
                  <div className={`w-2 h-2 ${t.mutedBg} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className={`${t.panelBg} border-t ${t.border} px-6 py-4`}>
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about lending markets, positions, or actions..."
              disabled={isLoading}
              className={`flex-1 px-4 py-2 border ${t.borderSm} rounded-lg ${t.cardBg} ${t.textPrimary} placeholder-stone-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60`}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
