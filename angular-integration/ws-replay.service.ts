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
 * WebSocket Message Viewer Service
 * 
 * Provides functionality for viewing, filtering, and grouping WebSocket messages
 * by requestId. Integrates with WsService for message capture and viewing.
 */
@Injectable({
    providedIn: 'root'
})
export class WsMessageViewerService {
    private _messageHistory: TimeMachineMessage[] = [];
    
    /**
     * Emits status messages about operations
     */
    readonly status$ = new Subject<string>();

    /**
     * Get the current message history
     */
    get messageHistory(): TimeMachineMessage[] {
        return [...this._messageHistory];
    }

    /**
     * Load message history from JSON data
     */
    loadHistory(history: TimeMachineMessage[]): void {
        this._messageHistory = history;
        this.status$.next(`Loaded ${history.length} messages into history`);
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
            this.status$.next('Failed to import history: Invalid JSON');
            throw error;
        }
    }

    /**
     * Clear the message history
     */
    clearHistory(): void {
        this._messageHistory = [];
        this.status$.next('History cleared');
    }

    /**
     * Parse message data with error handling
     */
    private parseMessageData(msg: TimeMachineMessage): any {
        try {
            return JSON.parse(msg.data);
        } catch {
            return null;
        }
    }

    /**
     * Filter messages by requestId
     */
    filterByRequestId(requestId: string): TimeMachineMessage[] {
        if (!requestId) {
            return this._messageHistory;
        }
        
        return this._messageHistory.filter(msg => {
            const data = this.parseMessageData(msg);
            return data && data.requestId && data.requestId.includes(requestId);
        });
    }

    /**
     * Group messages by requestId
     * Returns a Map where keys are requestIds and values are arrays of messages
     */
    groupByRequestId(messages?: TimeMachineMessage[]): Map<string, TimeMachineMessage[]> {
        const msgs = messages || this._messageHistory;
        const groups = new Map<string, TimeMachineMessage[]>();
        
        for (const msg of msgs) {
            const data = this.parseMessageData(msg);
            const requestId = data?.requestId;
            
            if (requestId) {
                if (!groups.has(requestId)) {
                    groups.set(requestId, []);
                }
                groups.get(requestId)!.push(msg);
            }
        }
        
        return groups;
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
}
