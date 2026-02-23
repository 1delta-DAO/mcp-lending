# MCP Lending Agent - Visual Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          End User                                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   FRONTEND (React + Vite)      │
        │   Chat Interface               │
        │   - Message history            │
        │   - User input                 │
        │   - Loading states             │
        │   Port: 3000                   │
        └────────────────┬───────────────┘
                         │ HTTP/REST
                         ▼ (TODO: Backend API needed)
        ┌────────────────────────────────┐
        │   CLIENT (Node.js)             │
        │   Claude + MCP Integration     │
        │   - Agentic loop               │
        │   - Tool management            │
        │   - Response formatting        │
        └────────────────┬───────────────┘
                         │ MCP Protocol
                         │ (JSON-RPC/stdio)
                         ▼
        ┌────────────────────────────────┐
        │   BACKEND (Node.js)            │
        │   MCP Server                   │
        │                                │
        │   9 Lending Tools:             │
        │   1. get_lending_markets       │
        │   2. get_user_positions        │
        │   3. get_deposit_calldata      │
        │   4. get_withdraw_calldata     │
        │   5. get_borrow_calldata       │
        │   6. get_repay_calldata        │
        │   7. get_token_balances        │
        │   8. get_supported_chains      │
        │   9. get_lender_ids            │
        │                                │
        └────────────────┬───────────────┘
                         │ REST API
                         ▼
        ┌────────────────────────────────┐
        │   1Delta Lending API           │
        │   https://portal.1delta.io/v1  │
        │                                │
        │   /data/*        - Market data │
        │   /actions/*     - Transactions│
        │   /token/*       - Token info  │
        └────────────────────────────────┘
```

## User Interaction Flow

```
User: "What are the best AAVE markets on Ethereum with 5% yield?"
                    │
                    ▼
         ┌──────────────────────┐
         │  Frontend Chat UI    │
         │  Captures input      │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Send to Claude     │
         │   Include tools info │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │  Claude Analyzes Query   │
         │  Selects best tool       │
         │  Tool: get_lending_markets
         │  Params: chainId=1,      │
         │          lender=AAVE_V3, │
         │          minYield=0.05   │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Client Calls MCP Tool    │
         │ (via MCP Protocol)       │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Backend Receives Call    │
         │ Validates parameters     │
         │ Routes to 1Delta API     │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ 1Delta API Response      │
         │ Market data returned     │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Backend Formats Result   │
         │ Returns to Client        │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Claude Processes Data    │
         │ Analyzes markets         │
         │ Generates response       │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Frontend Displays        │
         │ "The top AAVE markets    │
         │ on Ethereum are..."      │
         └──────────────────────────┘
```

## Package Relationships

```
                    ┌─────────────────┐
                    │  package.json   │
                    │  Root Workspace │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │  backend/    │ │  client/     │ │  frontend/   │
        │              │ │              │ │              │
        │ MCP Server   │ │ Claude +     │ │ React UI     │
        │              │ │ MCP Client   │ │              │
        │ @mcp-lending/│ │ @mcp-lending/│ │ @mcp-lending/│
        │ backend      │ │ client       │ │ frontend     │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                │                │
               │ depends        │ depends        │ depends
               │ on SDK         │ on SDK         │ on React
               │                │                │
               └────────┬───────┴────────────────┘
                        │
                   ┌────┴────┐
                   │   SDK   │
                   │Shared   │
                   │Packages │
                   └─────────┘
```

## Monorepo Structure

```
MCP/
├── 📄 package.json              ← Root workspace config
├── 📄 pnpm-workspace.yaml       ← Workspace definition
├── 📄 tsconfig.json             ← Shared TypeScript config
├── 📄 README.md                 ← Main documentation
├── 📄 QUICKSTART.md             ← Quick start guide
├── 📄 ARCHITECTURE.md           ← Architecture details
├── 📄 PROJECT_SUMMARY.md        ← This project summary
├── 📄 .gitignore                ← Git configuration
├── 📄 .npmrc                    ← npm configuration
│
└── 📁 packages/
    ├── 📁 backend/              ← MCP Server Package
    │   ├── 📁 src/
    │   │   └── 📄 index.ts      ← MCP server implementation
    │   ├── 📄 package.json
    │   ├── 📄 tsconfig.json
    │   └── 📄 README.md
    │
    ├── 📁 client/               ← MCP Client Package
    │   ├── 📁 src/
    │   │   └── 📄 index.ts      ← Claude integration
    │   ├── 📄 package.json
    │   ├── 📄 tsconfig.json
    │   └── 📄 README.md
    │
    └── 📁 frontend/             ← Frontend Package
        ├── 📁 src/
        │   ├── 📄 ChatContainer.tsx  ← Main UI component
        │   ├── 📄 main.tsx           ← Entry point
        │   └── 📄 index.css          ← Styles
        ├── 📄 index.html
        ├── 📄 vite.config.ts
        ├── 📄 tailwind.config.js
        ├── 📄 postcss.config.js
        ├── 📄 package.json
        ├── 📄 tsconfig.json
        └── 📄 README.md
```

## Tool Execution Path

```
User Query
    │
    ▼
┌─────────────────────────┐
│ Claude AI               │
│ Selects appropriate tool│
│ Generates parameters    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Client executes tool    │
│ Calls MCP backend       │
└────────┬────────────────┘
         │
         ▼ (MCP Protocol)
┌─────────────────────────┐
│ Backend receives call   │
│ Validates parameters    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Select API endpoint     │
│ Format request          │
└────────┬────────────────┘
         │
         ▼ (REST API)
┌─────────────────────────┐
│ 1Delta API receives call│
│ Processes request       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Returns data            │
│ (Market data, positions,│
│  transaction calldata)  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Backend formats result  │
│ Returns via MCP         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Client receives result  │
│ Passes to Claude        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Claude analyzes data    │
│ Formulates response     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Client displays response│
│ (or continues loop)     │
└─────────────────────────┘
```

## Data Types Flow

```
User Input (String)
    ↓
Claude Request (OpenAI Message Format)
    ↓
Tool Definition (JSON Schema)
    ↓
Tool Call (tool_use block)
    ↓
MCP Protocol (JSON-RPC)
    ↓
Backend Tool Handler (TypeScript)
    ↓
API Request (HTTP GET/POST)
    ↓
API Response (JSON)
    ↓
Tool Result (JSON String)
    ↓
Claude Continuation (Message with tool_result)
    ↓
Final Response (Natural Language)
    ↓
Frontend Display (Rendered Message)
```

## Component Responsibilities

```
┌────────────────────┐
│  Frontend          │
│  ─────────────     │
│  ✓ Render UI       │
│  ✓ Handle input    │
│  ✓ Display output  │
│  ✓ Show loading    │
│  ✓ Format messages │
└────────────────────┘

┌────────────────────┐
│  Client            │
│  ─────────────     │
│  ✓ Connect to MCP  │
│  ✓ Call Claude     │
│  ✓ Execute tools   │
│  ✓ Manage loop     │
│  ✓ Error handling  │
└────────────────────┘

┌────────────────────┐
│  Backend           │
│  ─────────────     │
│  ✓ Expose tools    │
│  ✓ Call APIs       │
│  ✓ Format data     │
│  ✓ Handle errors   │
│  ✓ Validate input  │
└────────────────────┘
```

---

**Visual guide for the MCP Lending Agent architecture and data flows.**
