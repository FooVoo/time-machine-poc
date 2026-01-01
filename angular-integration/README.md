# Angular Integration for WebSocket Time Machine

This directory contains the Angular integration files for adding replay mode functionality to your existing `WsService`.

## Files

- `ws-replay.service.ts` - Replay service that manages message history and interception
- `ws-service-integration.md` - Integration guide with code examples

## Quick Start

### 1. Add the WsReplayService to your project

Copy `ws-replay.service.ts` to your Angular project's services directory.

### 2. Inject the service into your WsService

```typescript
constructor(
    // ... existing dependencies
    private wsReplayService: WsReplayService
) {
    // ... existing code
}
```

### 3. Modify the _sendMessage method

Update your `_sendMessage` method to check for replay mode:

```typescript
private _sendMessage(request: RequestObject): void {
    const requestData = JSON.stringify(request);
    
    // Check if replay mode should intercept this message
    const replayResponse = this.wsReplayService.getReplayResponse(requestData);
    
    if (replayResponse) {
        // Message intercepted - simulate the response after a short delay
        setTimeout(() => {
            const actions = JSON.parse(replayResponse) as ActionObject[];
            this._subject$.next(actions);
        }, 100);
        
        // Log to debug service
        if (environment.debug) {
            this.storeDebugService.registerMessage(request);
            this.storeDebugService.registerMessage(JSON.parse(replayResponse));
        }
        
        return; // Don't send to actual WebSocket
    }
    
    // Normal flow - send to WebSocket
    if (environment.debug) {
        this.storeDebugService.registerMessage(request);
    }
    this._worker.postMessage(new SendMessage(requestData));
}
```

### 4. Capture messages for history (optional)

If you want to capture messages in real-time for export:

```typescript
private _sendMessage(request: RequestObject): void {
    const requestData = JSON.stringify(request);
    
    // Capture sent message
    this.wsReplayService.addMessageToHistory('sent', requestData);
    
    // ... rest of the method
}

// In _processActions or where you receive messages:
private _processActions(action: ActionObject): void {
    // Capture received message
    this.wsReplayService.addMessageToHistory('received', JSON.stringify(action));
    
    // ... rest of the method
}
```

### 5. Usage in your application

```typescript
export class SomeComponent {
    constructor(
        private wsReplayService: WsReplayService
    ) {}

    async loadHistory(file: File) {
        await this.wsReplayService.importHistoryFromFile(file);
    }

    enableReplayMode() {
        this.wsReplayService.setReplayMode(true);
    }

    disableReplayMode() {
        this.wsReplayService.setReplayMode(false);
    }

    exportHistory() {
        const json = this.wsReplayService.exportHistory();
        // Download or save the JSON
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ws-messages-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
}
```

## Message Format

The replay service expects messages in this format:

```json
[
  {
    "timestamp": "2026-01-01T06:00:00.000Z",
    "type": "sent",
    "data": "{\"requestNameSocketReconnect\":0,\"requestId\":\"abc123\"}"
  },
  {
    "timestamp": "2026-01-01T06:00:00.100Z",
    "type": "received",
    "data": "[{\"requestId\":\"abc123\",\"requestStatus\":\"OK\"}]"
  }
]
```

## Features

- **O(1) Message Matching**: Uses a Map for fast lookup of responses
- **Automatic Interception**: Messages matching history are automatically intercepted
- **Pass-through**: Non-matching messages are sent to the real WebSocket
- **Status Observable**: Subscribe to `replayStatus$` for real-time status updates
- **Real-time Capture**: Optionally capture all messages for export

## Integration with StoreDebugService

Since your `StoreDebugService` already stores all messages, you can use it to export history:

```typescript
export class StoreDebugService {
    private messages: Array<{timestamp: Date, direction: 'sent' | 'received', data: any}> = [];
    
    registerMessage(data: any) {
        // Your existing logic
        this.messages.push({
            timestamp: new Date(),
            direction: this.determineDirection(data),
            data: data
        });
    }
    
    exportForTimeMachine(): TimeMachineMessage[] {
        return this.messages.map(msg => ({
            timestamp: msg.timestamp.toISOString(),
            type: msg.direction,
            data: JSON.stringify(msg.data)
        }));
    }
}
```

## Example: Complete Integration

See `ws-service-integration-example.ts` for a complete example of the modified WsService.
