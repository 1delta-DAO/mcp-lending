# Frontend - Chat UI

A minimal React-based chat interface for interacting with the lending agent. Built with Vite, React, and Tailwind CSS.

## Overview

This package provides a clean, responsive chat UI for users to interact with the MCP lending agent. It's intentionally minimal for the PoC but ready for backend integration.

## Features

- **Message History:** Displays conversation in chronological order
- **Real-time UI:** Smooth scrolling to latest messages
- **Loading States:** Shows typing indicator while agent responds
- **Responsive Design:** Works on mobile and desktop
- **Input Validation:** Prevents empty message submissions
- **Timestamps:** Shows when each message was sent

## UI Components

### Main Container (`ChatContainer.tsx`)

Root component that manages:
- Message state
- User input
- Loading states
- Auto-scroll on new messages

### Message Display

Messages are colored differently:
- **User messages:** Blue, right-aligned
- **Agent messages:** Gray, left-aligned
- **Timestamps:** Displayed in message

### Input Area

- Text input field with placeholder
- Send button
- Disabled while loading
- Prevents empty submissions

## Layout

```
┌─────────────────────────────────┐
│  Lending Agent Header           │
├─────────────────────────────────┤
│                                 │
│  Message History                │
│  (auto-scrolls to bottom)       │
│                                 │
├─────────────────────────────────┤
│ [Input field] [Send button]     │
└─────────────────────────────────┘
```

## Development

### Setup

```bash
cd packages/frontend
pnpm install
```

### Running

```bash
pnpm dev
```

Opens at `http://localhost:3000` with hot reload.

### Building

```bash
pnpm build
```

Generates optimized bundle in `dist/`.

## Styling

Built with **Tailwind CSS** for rapid UI development:

- Dark header with border
- White chat area with message spacing
- Blue user messages (right-aligned)
- Gray agent messages (left-aligned)
- Clean input with focus states

## Integration

### Connecting to Backend

Currently, messages are simulated. To connect to the backend:

1. **Replace simulated response** in `handleSendMessage()`:

```typescript
// Current (simulated):
const agentMessage = {
  type: 'agent',
  content: 'Connected to lending agent. Response would appear here.',
};

// Replace with API call:
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: input }),
});
const data = await response.json();
const agentMessage = {
  type: 'agent',
  content: data.response,
};
```

2. **Set up backend API endpoint** (not included in PoC)

3. **Add authentication** if needed

### Message Format

```typescript
interface Message {
  id: string;           // Unique identifier
  type: 'user' | 'agent';
  content: string;      // Message text
  timestamp: Date;      // When sent
}
```

## Features to Add

For production readiness:

1. **Markdown Support:** Parse markdown in agent responses
2. **Code Blocks:** Syntax highlighting for code
3. **Transaction Details:** Show action calldata with formatting
4. **Copy Buttons:** Copy transaction data easily
5. **Real-time Updates:** WebSocket for live responses
6. **User Settings:** Theme, font size, etc.
7. **Export:** Save conversation as PDF or JSON
8. **Error Display:** Better error messages and recovery

## Component Structure

```
frontend/
├── src/
│   ├── ChatContainer.tsx    # Main UI component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── index.html               # HTML shell
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── postcss.config.js       # PostCSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Styling Guide

### Color Scheme

- **Header:** `bg-white` with subtle border
- **User Messages:** `bg-blue-600` (primary action color)
- **Agent Messages:** `bg-gray-200`
- **Text:** Dark gray on light, white on dark
- **Borders:** Light gray (`border-gray-200`)

### Responsive Breakpoints

Uses Tailwind's responsive modifiers:
- Mobile: Default
- Tablet/Desktop: `lg:max-w-md` (message width increases on larger screens)

## State Management

Currently using React hooks:
- `messages` - Array of message objects
- `input` - Current input value
- `isLoading` - Loading state
- `messagesEndRef` - For auto-scroll

For larger apps, consider:
- Context API for global state
- Redux or Zustand for complex state
- React Query for server state

## Performance

- Lightweight dependencies (React only)
- Lazy rendering of messages (DOM reflow optimization)
- Efficient scroll-to-bottom using refs
- No unnecessary re-renders

## Accessibility

- Semantic HTML
- ARIA labels (can add)
- Keyboard navigation (can enhance)
- Color contrast meets WCAG standards

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: All modern versions

## Troubleshooting

### Hot reload not working
```bash
# Restart dev server
pnpm dev
```

### Styling not applying
```bash
# Rebuild Tailwind CSS
pnpm build
```

### Build errors
```bash
# Clear cache and reinstall
rm -rf node_modules dist
pnpm install
```

## Next Steps

1. **Connect to backend API** - Replace simulated responses
2. **Add markdown support** - For richer formatting
3. **Implement real-time updates** - WebSocket integration
4. **Add transaction signing** - Ethers.js integration
5. **User authentication** - Wallet connection
6. **Conversation persistence** - Save to database

## References

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)
