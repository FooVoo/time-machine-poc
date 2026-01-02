# WebSocket Time Machine

A Svelte-based web component for viewing, filtering, and analyzing WebSocket messages. This tool allows you to record WebSocket communications, save them for later analysis, and view them with advanced filtering and grouping capabilities.

## Features

- 🔌 **WebSocket Connection Management**: Connect to any WebSocket server (view-only mode)
- 📝 **Message Capture**: Auto-capture incoming messages
- 🔍 **Advanced Filtering**: 
  - Filter by Request ID
  - Custom field filtering with autocomplete (supports nested fields like `data.user.name`)
- 📊 **Group by Request ID**: Group related request/response pairs by their requestId
- 📖 **JSON Viewer**: Expandable JSON viewer with syntax highlighting for message inspection
- 💾 **Export Messages**: Save captured messages as JSON files
- 📂 **Import Messages**: Load previously saved message sessions
- 🎨 **Modern UI**: Clean, intuitive interface with real-time status updates
- 🧩 **Web Component**: Built as a custom element for easy integration
- ⚡ **High Performance**: Optimized to handle large datasets (5-10MB, 10,000+ messages)
- 📄 **Example Data**: Includes 2,000+ sample messages for testing

## Quick Start

### Try with Example Data

1. Open `demo.html` in your browser
2. Click **"Import Messages"**
3. Select `example-messages.json` from the repository
4. Explore 2,000+ sample messages with all features enabled

See [EXAMPLE_MESSAGES.md](./EXAMPLE_MESSAGES.md) for detailed information about the example data and how to use it.

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
2. **Enable Capture**: Check "Auto-capture messages" to start recording incoming messages
3. **View Messages**: Messages appear in the list below as they arrive
4. **Export**: Click "Export Messages" to download captured messages as JSON
5. **Import**: Click "Import Messages" to load a previously saved session
6. **Clear**: Click "Clear Messages" to remove all captured messages

### Filtering and Grouping

The component supports advanced filtering and grouping of messages by `requestId`:

1. **Filter by Request ID**: Enter a request ID in the filter field to show only messages containing that ID
2. **Group by Request ID**: Check "Group by Request ID" to group related request/response pairs together

This is useful for:
- Finding specific request/response pairs in large message logs
- Analyzing message flow for specific operations
- Debugging request/response cycles
- Understanding message patterns

**Note**: Filtering and grouping require that messages have a `requestId` field in their JSON data.

## Message Format

Exported messages are saved in JSON format:

```json
[
  {
    "timestamp": "2026-01-01T06:00:00.000Z",
    "type": "received",
    "data": "{\"requestId\": \"abc123\", \"message\": \"Hello from server\"}"
  },
  {
    "timestamp": "2026-01-01T06:00:01.000Z",
    "type": "sent",
    "data": "{\"requestId\": \"abc123\", \"message\": \"Hello from client\"}"
  }
]
```

For filtering and grouping to work, the `data` field should contain JSON with a `requestId` field.

## Technical Details

- **Framework**: Svelte 5
- **Build Tool**: Vite 7
- **Output**: Custom Element (Web Component)
- **Browser Support**: Modern browsers with Web Components support

## Performance

The component is optimized to handle large message datasets efficiently:

- **Pagination**: Messages are displayed in pages of 50 for smooth scrolling
- **Optimized Operations**: Array operations use `push()` instead of spread operator
- **Efficient Lookups**: Map-based response matching for O(1) performance
- **Single-Pass Algorithms**: O(n) complexity for building response maps

For detailed performance information, see [PERFORMANCE.md](PERFORMANCE.md).

**Tested with**: 10,000+ messages, 5-10MB JSON files

## Code Quality

This project uses ESLint and Prettier for code quality and formatting:

### Available Scripts

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors where possible
npm run lint:fix

# Check code formatting
npm run format:check

# Auto-format all files
npm run format
```

### Configuration

- **ESLint**: Configured with strict rules for JavaScript and Svelte
- **Prettier**: Configured for consistent code formatting with Svelte support
- Configuration files: `eslint.config.js`, `.prettierrc`, `.prettierignore`

## License

ISC