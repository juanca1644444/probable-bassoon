# WhatsApp Pro / Vuelo 🚀

> **Advanced messaging app** inspired by deep REA (Reverse Engineering & Analysis) of WhatsApp Desktop v2.2134.10

---

## 📋 REA Analysis Findings

### Target: WhatsApp Desktop 2.2134.10 (Electron / Windows x64)

This project was designed based on a thorough analysis of WhatsApp Desktop's runtime artifacts.

#### Artifact Sources Analyzed

| Artifact | Location | Findings |
|----------|----------|----------|
| `main-process.log` | `AppData\Roaming\WhatsApp\` | Full lifecycle event sequence |
| `settings.json` | `AppData\Roaming\WhatsApp\` | App config schema v6 |
| `Databases.db` | `AppData\Roaming\WhatsApp\databases\` | Chromium WebSQL registry (mmap_status v2) |
| `Local Storage / leveldb` | `AppData\Roaming\WhatsApp\Local Storage\` | LevelDB key-value store (session tokens, prefs) |
| `IndexedDB / leveldb` | `AppData\Roaming\WhatsApp\IndexedDB\` | Primary message/chat store |
| `Service Worker Cache` | `AppData\Roaming\WhatsApp\Service Worker\` | Offline asset cache for web.whatsapp.com |
| `Preferences` | `AppData\Roaming\WhatsApp\` | Chromium session preferences |
| Running Process | PID 10844 `WhatsApp.Root` | Active at analysis time, 253 MB RAM |

#### Main Process Lifecycle (from logs — 2021-10-22T12:43:55Z)

```
WhatsApp Desktop 2.2134.10 Ready
→ Update from https://web.whatsapp.com/desktop/windows/release/x64?version=2.2134.10
→ windowState: { isMaximized: true, x: -8, y: -8, width: 1296, height: 696 }
→ WindowManager:setWindow()
→ WindowManager:createMenu()
→ Auto updater: checking for update  [5s delay]
→ Auto updater: update available → v2.2140.7
→ Setting Locale: es
→ VoipWindowManager:constructor()
→ VoipWindowManager:_createPanel()           [secondary BrowserWindow]
→ WindowManager:setVoipWindowManager()
→ WindowManager:createMenu()  →  destroyMenu()
→ device-manager: refresh device list returned: 3
→ VoipWindowManager:_createPanel() ready, took: 3210ms
→ VoipWindowManager:init()
→ App closed → destroyMenu() → VoipWindowManager:destructor() → cleanup() → _destroyPanel()
```

#### SQLite `Databases.db` Schema (Chromium WebSQL Registry)

```
TABLE meta:      { key: LONGVARCHAR PK, value: LONGVARCHAR }
TABLE Databases: { id: INTEGER PK, origin: TEXT, name: TEXT, description: TEXT, estimated_size: INTEGER }
```
- **Data**: meta rows = `mmap_status=-1`, `version=2`, `last_compatible_version=1`
- **Databases table is EMPTY** → WhatsApp does not use WebSQL for messages; it uses IndexedDB (LevelDB)

#### Settings Schema (`settings.json` v6)
```json
{
  "version": 6,
  "hasLoaded": true,
  "windowState": { "isMaximized": true, "width": 1296, "height": 696 },
  "contentSettings": { "textsize": 0 }
}
```

#### Squirrel Auto-Updater Pattern
- Update URL: `https://web.whatsapp.com/desktop/windows/release/x64?version={current}`
- Check on startup + every 7200s (2 hours)
- Downloads silently, installs on next restart
- Uses `SingleGlobalInstance` lock (Squirrel .NET) — prevents concurrent update locks

---

## 🏗️ WhatsApp Architecture (Extracted)

### Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Electron Main Process                       │
│                                                               │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │    WindowManager      │  │   VoipWindowManager         │   │
│  │  - setWindow()        │  │  - constructor()            │   │
│  │  - createMenu()       │  │  - _createPanel()           │   │
│  │  - destroyMenu()      │  │  - init() / cleanup()       │   │
│  │  - setVoipWindowMgr() │  │  - _destroyPanel()          │   │
│  └──────────────────────┘  └────────────────────────────┘   │
│                                                               │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Squirrel Auto-  │  │ Device Mgr   │  │  IPC Bridge   │  │
│  │  Updater         │  │ (3 devices)  │  │  (ipcMain)    │  │
│  └──────────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │ BrowserWindow.loadURL()
              ▼
┌─────────────────────────────────────────────────────────────┐
│              Renderer Process — web.whatsapp.com              │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  3-Panel Layout                         │  │
│  │  ┌──────────────┐ ┌─────────────────┐ ┌─────────────┐ │  │
│  │  │   Sidebar    │ │   Chat Panel    │ │ Right Panel │ │  │
│  │  │   (30% w)    │ │    (70% w)      │ │  (overlay)  │ │  │
│  │  │              │ │                 │ │             │ │  │
│  │  │ - Chat list  │ │ - MessageList   │ │ - Contact   │ │  │
│  │  │ - Search     │ │ - MessageInput  │ │   info      │ │  │
│  │  │ - Archive    │ │ - Header        │ │ - Media gal │ │  │
│  │  │ - New chat   │ │ - TypingInd.    │ │ - Group mbr │ │  │
│  │  └──────────────┘ └─────────────────┘ └─────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Data Store: IndexedDB (LevelDB)                              │
│  Service Worker: Offline cache for web.whatsapp.com assets    │
│  Local Storage: Session tokens, UI preferences                │
└─────────────────────────────────────────────────────────────┘
              │ Secondary BrowserWindow
              ▼
┌─────────────────────────┐
│   VoIP Panel            │
│  (3210ms init time)     │
│  Separate window, lazy  │
└─────────────────────────┘
```

### Data Models (Reverse-Engineered)

#### Message Model
```typescript
interface Message {
  id:        string;    // unique message ID
  chatId:    string;    // parent chat ID
  fromMe:    boolean;   // sent by current user
  type:      "chat" | "image" | "video" | "audio" | "document" | "sticker" | "location";
  body:      string;    // text content
  timestamp: number;    // Unix epoch seconds
  ack:       0 | 1 | 2 | 3 | 4;  // sent/delivered/read ticks
  hasMedia:  boolean;
  replyTo?:  string;    // quoted message ID
}
```

#### Chat Model
```typescript
interface Chat {
  id:          string;   // phone@s.whatsapp.net or group@g.us
  name:        string;
  lastMessage: string;
  t:           number;   // last message timestamp
  unreadCount: number;
  archived:    boolean;
  pinned:      boolean;
  muted:       boolean;
  isGroup:     boolean;
}
```

#### ACK States
| Value | Meaning | UI |
|-------|---------|-----|
| 0 | Pending | Clock ⏱ |
| 1 | Sent | ✓ |
| 2 | Delivered | ✓✓ |
| 3 | Read | ✓✓ (blue) |
| 4 | Played (audio) | ▶ (blue) |

### IPC Pattern
```
Renderer → ipcRenderer.send("wa-event", payload)
Main     → ipcMain.on("wa-event", handler)
Main     → win.webContents.send("wa-push", data)
```

---

## ✨ WhatsApp Pro Features

### Core Messaging
- 💬 Real-time messaging via WebSocket
- 📎 File/image attachments (drag-and-drop)
- 😊 Emoji picker with reaction support
- 💬 Reply-to-message with preview
- ✓✓ Message status ticks (sent/delivered/read)
- ⌨️ Typing indicators (animated dots)
- 🔍 Chat & message search
- 📌 Pin chats to top
- 🔇 Mute notifications per chat
- 🗂️ Archive chats

### Group Features
- 👥 Group chats with member list
- 🖼️ Group avatars and names
- 👑 Group admin roles

### UI/UX
- 🌙 Dark mode (WhatsApp-style dark theme)
- 📐 3-panel responsive layout (30/70 sidebar/chat)
- 🖼️ Media gallery (photos, videos, files, audio)
- 📱 Markdown message rendering
- 💻 Code block syntax highlighting
- 🤖 AI Chat Summary (POST /api/ai-summary/:chatId)
- 🌐 Spanish locale (es) — matching original

### Technical
- ⚡ Vite + React 18 (HMR dev server)
- 🗄️ SQLite persistence (better-sqlite3)
- 🔌 WebSocket real-time layer (ws)
- 📁 File uploads (multer)
- 🗃️ Zustand state management

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm 9+

### Installation

```bash
# Clone or navigate to project
cd whatsapp-pro

# Install root dev dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### Development

```bash
# Start both server + client concurrently
npm run dev
```

This runs:
- **Backend**: `http://localhost:3001` (Express + WebSocket + SQLite)
- **Frontend**: `http://localhost:5173` (Vite + React)

### Manual Start

```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
cd client && npx vite --host
```

---

## 📡 API Documentation

### Chats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chats` | List all chats (sorted by last message time) |
| POST | `/api/chats` | Create new chat |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/:chatId` | Get messages for a chat |
| POST | `/api/messages/:chatId` | Send a new message |

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List all contacts |
| POST | `/api/contacts` | Create a contact |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a file (multipart/form-data) |
| GET | `/uploads/:filename` | Serve uploaded file |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings` | Update a setting |

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai-summary/:chatId` | Generate AI summary of chat |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `typing` | Client → Server | `{ chatId, userId, isTyping }` |
| `message` | Server → Client | `{ type: "new_message", message }` |
| `typing_indicator` | Server → Client | `{ chatId, userId, isTyping }` |

---

## 🗂️ Project Structure

```
whatsapp-pro/
├── package.json              ← Root scripts (concurrently)
├── .gitignore
├── README.md
│
├── server/                   ← Node.js + Express + SQLite backend
│   ├── package.json
│   ├── index.js              ← Main server entry (Express + WS)
│   ├── database.js           ← SQLite schema + seed data
│   └── routes/
│       ├── chats.js
│       ├── messages.js
│       ├── contacts.js
│       └── files.js
│
└── client/                   ← React + Vite + Tailwind frontend
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── store/
        │   └── useStore.js
        ├── components/
        │   ├── Sidebar/
        │   ├── ChatPanel/
        │   ├── RightPanel/
        │   ├── AIAssistant/
        │   └── EmptyState/
        ├── hooks/
        │   └── useWebSocket.js
        └── utils/
            ├── api.js
            └── formatters.js
```

---

## 🔬 Design Patterns Applied from REA

| WhatsApp Pattern | Implementation in WhatsApp Pro |
|-----------------|-------------------------------|
| WindowManager singleton | Zustand store singleton |
| VoipWindowManager lazy init | RightPanel lazy-mounted on demand |
| Squirrel update URL pattern | `/api/settings` version polling |
| `setWindow()` → `createMenu()` sequence | App.jsx init → sidebar render sequence |
| Locale: `es` from main process | Spanish sample data throughout |
| IndexedDB (LevelDB) for messages | SQLite via better-sqlite3 |
| Service Worker offline cache | Vite PWA-ready build config |
| ACK states 0–4 | Message status: pending/sent/delivered/read |
| 3-panel 30%/70% layout | Sidebar flex-shrink-0 / Chat flex-1 CSS |
| `device-manager: 3 devices` | Multi-device session support stub |

---

## 📄 License

MIT — Built for educational purposes via reverse engineering analysis.
