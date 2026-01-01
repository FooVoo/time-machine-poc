import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Message structure for WebSocket Time Machine
 */
export interface TimeMachineMessage {
    timestamp: string;
    type: 'sent' | 'received';
    data: string;
}

/**
 * WebSocket Replay Service
 * 
 * Integrates with WsService to provide replay mode functionality
 * for intercepting and replaying WebSocket messages from history.
 */
@Injectable({
    providedIn: 'root'
})
export class WsReplayService {
    private _replayMode = false;
    private _messageHistory: TimeMachineMessage[] = [];
    private _responseMap: Map<string, string> = new Map();
    
    /**
     * Emits status messages about replay operations
     */
    readonly replayStatus$ = new Subject<string>();

    /**
     * Check if replay mode is currently enabled
     */
    get isReplayMode(): boolean {
        return this._replayMode;
    }

    /**
     * Get the current message history
     */
    get messageHistory(): TimeMachineMessage[] {
        return [...this._messageHistory];
    }

    /**
     * Enable or disable replay mode
     */
    setReplayMode(enabled: boolean): void {
        if (enabled && this._messageHistory.length === 0) {
            console.warn('Cannot enable replay mode: no history loaded');
            this.replayStatus$.next('Cannot enable replay mode: no history loaded');
            return;
        }
        this._replayMode = enabled;
        this.replayStatus$.next(enabled ? 'Replay mode enabled' : 'Replay mode disabled');
    }

    /**
     * Load message history from JSON data
     * This should be called with the exported message history
     */
    loadHistory(history: TimeMachineMessage[]): void {
        this._messageHistory = history;
        this._buildResponseMap();
        this.replayStatus$.next(`Loaded ${history.length} messages into history`);
    }

    /**
     * Import history from a JSON file
     */
    async importHistoryFromFile(file: File): Promise<void> {
        try {
            const text = await file.text();
            const history = JSON.parse(text) as TimeMachineMessage[];
            this.loadHistory(history);
        } catch (error) {
            console.error('Failed to import history:', error);
            this.replayStatus$.next('Failed to import history: Invalid JSON');
            throw error;
        }
    }

    /**
     * Clear the message history and disable replay mode
     */
    clearHistory(): void {
        this._messageHistory = [];
        this._responseMap.clear();
        this._replayMode = false;
        this.replayStatus$.next('History cleared');
    }

    /**
     * Check if a message should be intercepted and get the replay response
     * Returns the response data if found, null if message should pass through
     */
    getReplayResponse(messageData: string): string | null {
        if (!this._replayMode) {
            return null;
        }

        const response = this._responseMap.get(messageData);
        
        if (response) {
            this.replayStatus$.next('Replayed from history');
            return response;
        } else {
            this.replayStatus$.next('No match in history, passing through');
            return null;
        }
    }

    /**
     * Add a message to the history (for real-time capture)
     */
    addMessageToHistory(type: 'sent' | 'received', data: string): void {
        const message: TimeMachineMessage = {
            timestamp: new Date().toISOString(),
            type,
            data
        };
        this._messageHistory.push(message);
    }

    /**
     * Export the current message history as JSON
     */
    exportHistory(): string {
        return JSON.stringify(this._messageHistory, null, 2);
    }

    /**
     * Build a response map for O(1) lookup
     * Maps sent messages to their corresponding received responses
     */
    private _buildResponseMap(): void {
        this._responseMap.clear();
        
        for (let i = 0; i < this._messageHistory.length; i++) {
            if (this._messageHistory[i].type === 'sent') {
                // Look for the next received message
                for (let j = i + 1; j < this._messageHistory.length; j++) {
                    if (this._messageHistory[j].type === 'received') {
                        this._responseMap.set(
                            this._messageHistory[i].data,
                            this._messageHistory[j].data
                        );
                        break;
                    }
                }
            }
        }
    }
}
