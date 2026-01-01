import { Component } from '@angular/core';
import { WsService } from '../services/ws.service';
import { WsReplayService } from '../services/ws-replay.service';

/**
 * Example Angular component for WebSocket Time Machine controls
 * 
 * This component provides UI controls for:
 * - Importing message history
 * - Enabling/disabling replay mode
 * - Exporting message history
 * - Viewing replay status
 */
@Component({
    selector: 'app-ws-time-machine-controls',
    template: `
        <div class="ws-time-machine-controls">
            <h3>WebSocket Time Machine</h3>
            
            <!-- Status Display -->
            <div class="status-panel">
                <p>
                    <strong>Status:</strong> {{ replayStatus }}
                </p>
                <p *ngIf="messageCount > 0">
                    <strong>History:</strong> {{ messageCount }} messages loaded
                </p>
            </div>

            <!-- Import Controls -->
            <div class="control-group">
                <label class="file-label">
                    <input 
                        type="file" 
                        accept=".json" 
                        (change)="onFileSelected($event)"
                        style="display: none"
                    />
                    <button nz-button nzType="default">
                        <i nz-icon nzType="upload"></i>
                        Import Message History
                    </button>
                </label>
            </div>

            <!-- Replay Mode Toggle -->
            <div class="control-group" *ngIf="messageCount > 0">
                <label nz-checkbox [(ngModel)]="replayModeEnabled" (ngModelChange)="onReplayModeChange()">
                    Enable Replay Mode
                </label>
                <p class="help-text">
                    When enabled, matching messages will be intercepted and responses replayed from history
                </p>
            </div>

            <!-- Export Controls -->
            <div class="control-group">
                <button 
                    nz-button 
                    nzType="primary" 
                    (click)="exportHistory()"
                    [disabled]="messageCount === 0"
                >
                    <i nz-icon nzType="download"></i>
                    Export Message History ({{ messageCount }})
                </button>
            </div>

            <!-- Clear Controls -->
            <div class="control-group">
                <button 
                    nz-button 
                    nzType="default" 
                    nzDanger
                    (click)="clearHistory()"
                    [disabled]="messageCount === 0"
                >
                    <i nz-icon nzType="delete"></i>
                    Clear History
                </button>
            </div>
        </div>
    `,
    styles: [`
        .ws-time-machine-controls {
            padding: 20px;
            background: #f5f5f5;
            border-radius: 8px;
            margin: 20px 0;
        }

        .status-panel {
            background: white;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .control-group {
            margin-bottom: 15px;
        }

        .help-text {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }

        .file-label {
            cursor: pointer;
        }
    `]
})
export class WsTimeMachineControlsComponent {
    replayModeEnabled = false;
    replayStatus = 'No history loaded';
    messageCount = 0;

    constructor(
        private wsService: WsService
    ) {
        // Subscribe to replay status updates
        this.wsService.replayService.replayStatus$.subscribe(status => {
            this.replayStatus = status;
        });

        // Update message count when history changes
        this.updateMessageCount();
    }

    async onFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (file) {
            try {
                await this.wsService.importMessageHistory(file);
                this.updateMessageCount();
            } catch (error) {
                console.error('Failed to import history:', error);
                // You might want to show a notification here
            }
            
            // Reset input to allow selecting the same file again
            input.value = '';
        }
    }

    onReplayModeChange(): void {
        this.wsService.replayService.setReplayMode(this.replayModeEnabled);
    }

    exportHistory(): void {
        const json = this.wsService.exportMessageHistory();
        
        // Create and download the file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `websocket-messages-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    clearHistory(): void {
        this.wsService.replayService.clearHistory();
        this.replayModeEnabled = false;
        this.updateMessageCount();
    }

    private updateMessageCount(): void {
        this.messageCount = this.wsService.replayService.messageHistory.length;
    }
}
