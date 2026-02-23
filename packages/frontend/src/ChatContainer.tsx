import React from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export default function ChatContainer() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const clientUrl = import.meta.env.VITE_CLIENT_URL ?? 'http://localhost:3001';
      const { data } = await axios.post<{ response: string }>(
        `${clientUrl}/chat`,
        { query: input }
      );

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: 'Error: could not reach the agent. Is the client server running?',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lending Agent</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">AI-powered lending platform assistant</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">by 1delta</p>
        </div>
        <button
          onClick={() => setDarkMode(d => !d)}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">Welcome to Lending Agent</p>
              <p className="text-sm mt-2">Start by asking about lending markets, positions, or actions</p>
            </div>
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
                    : 'max-w-xl lg:max-w-2xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                }`}
              >
                {message.type === 'user' ? (
                  <p className="text-sm">{message.content}</p>
                ) : (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                )}
                <span className={`text-xs mt-2 block ${message.type === 'user' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about lending markets, positions, or actions..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 font-medium transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
