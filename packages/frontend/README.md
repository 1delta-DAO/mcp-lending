# Frontend

React chat UI for the 1Delta lending agent. Built with Vite, Tailwind CSS, and wagmi for wallet connectivity.

## Features

- **Chat interface** — markdown-rendered agent responses with real-time typing indicator
- **Wallet connection** — injected wallet (MetaMask etc.) via wagmi. Connected address is sent to the agent automatically so it can query your positions.
- **Transaction executor** — when the agent returns calldata, a step-by-step transaction panel appears with per-step status (idle / pending / success / error) and retry support
- **Chain switching** — automatically prompts the wallet to switch to the correct chain before each transaction (derived from the `marketUid` in the response)
- **AI provider selector** — dropdown in the header to switch between providers (Anthropic, OpenAI, Google, Gemini, Groq, Mistral, DeepSeek) per message; no server restart needed
- **Dark mode** — toggle in the header; preference persisted in `localStorage`
- **34 supported chains** — wagmi config covers all chains supported by 1Delta

## Layout

```
┌──────────────────────────────────────────────────────┐
│  Lending Agent  by 1delta   [Provider ▾] [Wallet] [☀] │
├──────────────────────────────────────────────────────┤
│                                                      │
│   [Agent message with markdown]                      │
│   ┌─ 2 transactions to execute ──────────────────┐  │
│   │  ○ approve  0xabc...                         │  │
│   │  ○ deposit  0xdef...                         │  │
│   │         [Execute Transactions]               │  │
│   └──────────────────────────────────────────────┘  │
│                              [User message]          │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Ask about lending markets...]          [Send]      │
└──────────────────────────────────────────────────────┘
```

## Component overview

| File | Responsibility |
|---|---|
| `ChatContainer.tsx` | Root component — message state, API calls, header, input form |
| `TxExecutor.tsx` | Transaction step panel — executes calldata sequentially, handles chain switching |
| `WalletButton.tsx` | Connect / disconnect wallet |
| `wagmi.ts` | wagmi config with all 34 supported chains |

## Environment

```bash
# packages/frontend/.env
VITE_CLIENT_URL=http://localhost:3001   # URL of the client HTTP server
```

## Setup

```bash
pnpm dev      # http://localhost:3000 with hot reload
pnpm build    # production bundle → dist/
```
