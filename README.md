# WebSocket Time Machine

A Svelte-based web component for capturing, exporting, and importing WebSocket messages. This tool allows you to record WebSocket communications, save them for later analysis, and replay them.

## Features

- 🔌 **WebSocket Connection Management**: Connect to any WebSocket server
- 📝 **Message Capture**: Auto-capture incoming and outgoing messages
- 🔄 **Replay Mode**: Intercept outgoing messages and replay matching responses from history
- 💾 **Export Messages**: Save captured messages as JSON files
- 📂 **Import Messages**: Load previously saved message sessions
- 🎨 **Modern UI**: Clean, intuitive interface with real-time status updates
- 🧩 **Web Component**: Built as a custom element for easy integration

## Installation

```bash
npm install
```

## Development

Start the development server with hot-reload:

```bash
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Building

Build the web component for production:

```bash
npm run build
```

This generates:
- `dist/websocket-time-machine.es.js` - ES module format
- `dist/websocket-time-machine.umd.js` - UMD format

## Usage

### As a Web Component

After building, include the web component in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Time Machine</title>
</head>
<body>
  <websocket-time-machine></websocket-time-machine>
  <script type="module" src="./dist/websocket-time-machine.es.js"></script>
</body>
</html>
```

Or use the provided demo:

```bash
# Open demo.html in your browser
```

### Testing with Echo Server

A simple WebSocket echo server is included for testing:

```bash
node test-server.js
```

This starts a WebSocket server on `ws://localhost:8080` that echoes back any messages.

## How to Use

### Basic Usage

1. **Connect**: Enter a WebSocket URL (e.g., `ws://localhost:8080`) and click "Connect"
2. **Enable Capture**: Check "Auto-capture messages" to start recording
3. **Send Messages**: Type messages in the send field and press Enter or click "Send"
4. **Export**: Click "Export Messages" to download captured messages as JSON
5. **Import**: Click "Import Messages" to load a previously saved session
6. **Clear**: Click "Clear Messages" to remove all captured messages

### Replay Mode (Mock/Intercept Mode)

Replay mode allows you to intercept outgoing WebSocket messages and replay responses from a previously imported message history, useful for testing and development without a live server.

1. **Import History**: First, import a message history file using "Import Messages"
2. **Enable Replay Mode**: Check "Replay mode (intercept and match against history)"
3. **Connect**: Connect to any WebSocket URL (can be a dummy URL if you only want replayed responses)
4. **Send Messages**: When you send a message that matches a "sent" message in the history:
   - The message is **intercepted** (not sent to the actual WebSocket server)
   - The corresponding "received" message from history is automatically replayed
   - Status shows "Replayed from history"
5. **Pass-Through**: Messages that don't match the history are passed through to the actual WebSocket server
   - Status shows "No match in history, passing through"

This feature is perfect for:
- Testing frontend behavior with known server responses
- Development without backend availability
- Reproducing specific message sequences
- API mocking and stubbing

## Message Format

Exported messages are saved in JSON format:

```json
[
  {
    "timestamp": "2026-01-01T06:00:00.000Z",
    "type": "received",
    "data": "Hello from server"
  },
  {
    "timestamp": "2026-01-01T06:00:01.000Z",
    "type": "sent",
    "data": "Hello from client"
  }
]
```

## Technical Details

- **Framework**: Svelte 5
- **Build Tool**: Vite 7
- **Output**: Custom Element (Web Component)
- **Browser Support**: Modern browsers with Web Components support

## License

ISC