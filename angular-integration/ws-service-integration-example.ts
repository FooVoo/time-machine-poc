/**
 * WsService Integration Example with WebSocket Time Machine Replay Mode
 * 
 * This file shows how to integrate the WsReplayService into your existing WsService.
 * Key changes are marked with // REPLAY MODE comments
 */

import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, createSelector } from '@ngrx/store';
import { NzMessageRef, NzMessageService } from 'ng-zorro-antd/message';
import {
    BehaviorSubject,
    EMPTY,
    Observable,
    Subject,
    catchError,
    filter,
    from,
    of,
    shareReplay,
    switchMap,
    take,
    takeUntil,
    throwError,
    timeout,
} from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Md5 } from 'ts-md5';

import { environment } from '@env/environment';

import {
    ActionNGDTO,
    CompleteActionDTO,
    RequestStateDTO,
    SocketReconnectRequestDTO,
} from '../api/ms-bff';
import { DateFactory } from '../factories/date-factory';
import { ModalService } from '../services/modal.service';
import { NotificationService, NotificationType } from '../services/notification.service';
import { Rx } from '../utils/rx';
import { ActionObject, RequestObject, SendParamType, StackOperator } from './models/internal';
import { StoreDebugService } from './store-debug.service';
import { processData } from './store/actions';
import { selectorsData } from './store/selectors';
import { IDataState } from './store/state';
import { SocketEvent } from './worker/classes';
import { OpenConnection } from './worker/classes/open-connection';
import { Reconnect } from './worker/classes/reconnect';
import { SendMessage } from './worker/classes/send-message';
import { CommandType } from './worker/enums/command-type';

// REPLAY MODE: Import the replay service
import { WsReplayService, TimeMachineMessage } from './ws-replay.service';

import RequestStatusEnum = ActionNGDTO.RequestStatusEnum;

@UntilDestroy()
@Injectable()
export class WsService {
    readonly initialized: Promise<void>;
    readonly blockView$: Observable<boolean>;

    // REPLAY MODE: Expose replay service for components to use
    get replayService(): WsReplayService {
        return this.wsReplayService;
    }

    private readonly _wsReconnectTimeout = 3000;
    private readonly _requestTimeout = 120000;
    private readonly _healthCheckTimeout = 10000;
    private readonly _blockView$ = new BehaviorSubject<number>(0);
    private readonly _ready$ = new BehaviorSubject<boolean>(false);
    private readonly _disconnected$ = new Subject<void>();
    private readonly _initialized$ = new Subject<void>();
    private readonly _error$ = new Subject<string | void>();
    private readonly _subject$ = new Subject<ActionObject[]>();
    private readonly _callStack = new Map<
        string,
        {
            requestParams: SendParamType<unknown>;
            stated: boolean;
            sync: boolean;
            params?: {
                blockView?: boolean;
                ignoreAuth?: boolean;
            };
        }
    >();

    private _messageRef: NzMessageRef | null = null;
    private readonly _worker = new Worker(new URL('./worker/sync.worker', import.meta.url));

    private readonly _token$ = this.store.select(
        createSelector(selectorsData.userAuth, (d) => d?.token)
    );

    private readonly _sessionId$ = this.store.select(
        createSelector(selectorsData.connection, (d) => d?.sessionId)
    );

    constructor(
        private store: Store<IDataState>,
        private notificationService: NotificationService,
        private modalService: ModalService,
        private messageService: NzMessageService,
        private storeDebugService: StoreDebugService,
        // REPLAY MODE: Inject the replay service
        private wsReplayService: WsReplayService
    ) {
        this.blockView$ = this._blockView$.pipe(
            map((c) => c > 0),
            delay(100),
            shareReplay()
        );

        this._error$.subscribe((errorText) => {
            const modalData = errorText ? { content: errorText } : undefined;
            this.modalService.showCritical(modalData);
        });

        this.initialized = Rx.getValueFrom(
            this._initialized$.pipe(
                timeout({
                    first: this._healthCheckTimeout,
                    with: () => {
                        const message = 'Не удалось произвести синхронизацию';
                        this._error$.next(message);
                        return throwError(() => new Error(message));
                    },
                })
            )
        );

        // REPLAY MODE: Subscribe to replay status updates
        this.wsReplayService.replayStatus$
            .pipe(untilDestroyed(this))
            .subscribe((status) => {
                console.log('[WebSocket Replay]', status);
            });

        this._init();
    }

    send<T, R = unknown>(
        requestParams: SendParamType<T>,
        stated: false,
        sync: false,
        params?: {
            blockView?: boolean;
            ignoreAuth?: boolean;
        }
    ): Observable<Required<R>>;

    send<T>(
        requestParams: SendParamType<T>,
        stated: false,
        sync: true,
        params?: {
            blockView?: boolean;
            ignoreAuth?: boolean;
            retryAfterReconnect?: { key: string; operator: StackOperator };
        }
    ): Observable<CompleteActionDTO>;

    send<T>(
        requestParams: SendParamType<T>,
        stated: true,
        sync: true,
        params?: {
            blockView?: boolean;
            ignoreAuth?: boolean;
            retryAfterReconnect?: { key: string; operator: StackOperator };
        }
    ): Observable<CompleteActionDTO>;

    send<T>(
        requestParams: SendParamType<T>,
        stated: true,
        sync: false,
        params?: {
            retryAfterReconnect?: { key: string; operator: StackOperator };
        }
    ): void;

    send<T, R = unknown>(
        requestParams: SendParamType<T>,
        stated: boolean,
        sync: boolean,
        params?: {
            blockView?: boolean;
            ignoreAuth?: boolean;
            retryAfterReconnect?: { key: string; operator: StackOperator };
        }
    ): void | Observable<Required<R> | Observable<CompleteActionDTO>> {
        const request: RequestStateDTO = {
            ...requestParams,
            requestId: `${Md5.hashStr(JSON.stringify(requestParams))}#${Date.now().toString()}`,
            sync: sync != null ? sync : false,
            stated,
        };

        const blockView = params?.blockView;
        const retryAfterReconnect = params?.retryAfterReconnect;
        const ignoreAuth = params?.ignoreAuth;

        if (retryAfterReconnect != null) {
            const { operator, key } = retryAfterReconnect;

            switch (operator) {
                case StackOperator.add: {
                    this._callStack.set(key, {
                        requestParams: request,
                        stated,
                        sync,
                        params: { blockView, ignoreAuth },
                    });
                    break;
                }

                case StackOperator.remove: {
                    this._callStack.delete(key);
                    break;
                }
            }
        }

        if (stated && !sync) {
            this._ready$
                .pipe(
                    filter((e) => e || (ignoreAuth != null && ignoreAuth)),
                    take(1),
                    takeUntil(this._disconnected$)
                )
                .subscribe((e) => {
                    this._sendMessage(request);
                });
            return;
        }

        return this._ready$.pipe(
            filter((e) => e || (ignoreAuth != null && ignoreAuth)),
            take(1),
            switchMap(() => {
                this._sendMessage(request);

                if (blockView) {
                    this._blockView$.next(this._blockView$.value + 1);
                }

                return this._subject$.pipe(
                    switchMap((s) => from(s)),
                    filter(
                        (e) =>
                            e.requestId === request.requestId &&
                            (sync
                                ? e.requestStatus === ActionNGDTO.RequestStatusEnum.ERROR ||
                                  'stateNameComplete' in e
                                : true)
                    ),
                    switchMap((e) => {
                        if (blockView) {
                            this._blockView$.next(this._blockView$.value - 1);
                        }

                        switch (e.requestStatus) {
                            case ActionNGDTO.RequestStatusEnum.OK:
                                return e.operator === ActionNGDTO.OperatorEnum.CLEAR
                                    ? of(EMPTY)
                                    : of(e);

                            case ActionNGDTO.RequestStatusEnum.ERROR:
                                if (e.stackTrace && !stated) {
                                    console.error(e.stackTrace);
                                }
                                return throwError(
                                    () => new Error(e.comment || 'Неизвестная ошибка сервера')
                                );

                            default:
                                return throwError(() => new Error('Неизвестный статус запроса'));
                        }
                    }),
                    catchError((error: Error) => {
                        if (blockView) {
                            this._blockView$.next(this._blockView$.value - 1);
                        }

                        if (!stated) {
                            this.notificationService.createNotification(
                                NotificationType.ERROR,
                                'Ошибка',
                                error.message
                            );
                        }

                        return throwError(() => error);
                    }),

                    timeout({
                        first: this._requestTimeout,
                        with: () => {
                            this.notificationService.createNotification(
                                NotificationType.ERROR,
                                'Ошибка',
                                'Превышен интервал ожидания запроса'
                            );

                            return throwError(
                                () =>
                                    new Error(
                                        `Превышен интервал ожидания запроса.\nЗапрос: ${JSON.stringify(
                                            request
                                        )}`
                                    )
                            );
                        },
                    }),
                    take(1)
                ) as unknown as Observable<Required<R>>;
            }),
            takeUntil(this._disconnected$)
        );
    }

    forceReconnect(): void {
        this._worker.postMessage(new Reconnect());
    }

    // REPLAY MODE: Export current message history
    exportMessageHistory(): string {
        return this.wsReplayService.exportHistory();
    }

    // REPLAY MODE: Import message history from JSON
    async importMessageHistory(file: File): Promise<void> {
        await this.wsReplayService.importHistoryFromFile(file);
    }

    // REPLAY MODE: Alternative - import from StoreDebugService
    loadHistoryFromDebugService(): void {
        // If StoreDebugService has an export method
        // const messages = this.storeDebugService.exportForTimeMachine();
        // this.wsReplayService.loadHistory(messages);
    }

    private _processActions(action: ActionObject): void {
        const { requestStatus, stated, comment, stackTrace } = action;

        // REPLAY MODE: Capture received messages
        if (environment.debug) {
            this.storeDebugService.registerMessage(action);
            this.wsReplayService.addMessageToHistory('received', JSON.stringify(action));
        }

        if (stated) {
            switch (requestStatus) {
                case RequestStatusEnum.OK:
                    this.store.dispatch(processData({ action }));
                    break;

                case RequestStatusEnum.ERROR:
                    if (environment.production && environment.debug) {
                        this.storeDebugService.registerError(false);
                    }
                    if (stackTrace) {
                        console.error(stackTrace);
                    }
                    this.notificationService.createNotification(
                        NotificationType.ERROR,
                        'Ошибка',
                        comment || 'Что-то пошло не так...'
                    );
                    break;

                default:
                    throwError(() => new Error('Неизвестный статус запроса'));
            }
        }
    }

    private async _restoreSession(retrySendActions: boolean): Promise<void> {
        const token = await Rx.getValueFrom(this._token$);
        const oldSessionId = await Rx.getValueFrom(this._sessionId$);

        try {
            await Rx.getValueFrom(
                this.send<SocketReconnectRequestDTO>(
                    {
                        requestNameSocketReconnect: 0,
                        oldSessionId,
                        token,
                    },
                    true,
                    true,
                    { blockView: true, ignoreAuth: true }
                )
            );

            if (retrySendActions) {
                this._callStack.forEach((e) => {
                    const { stated, sync, params, requestParams } = e;

                    if (stated && sync) {
                        this.send(requestParams, stated, sync, params)
                            .pipe(untilDestroyed(this))
                            .subscribe();
                    }

                    if (stated && !sync) {
                        this.send(requestParams, stated, sync);
                    }

                    if (!stated && sync) {
                        this.send(requestParams, stated, sync, params)
                            .pipe(untilDestroyed(this))
                            .subscribe();
                    }

                    if (!stated && !sync) {
                        this.send(requestParams, stated, sync, params)
                            .pipe(untilDestroyed(this))
                            .subscribe();
                    }
                });
            }

            this._ready$.next(true);
        } catch (e) {
            this._subject$.complete();
            this._error$.next();
        }
    }

    private _init(): void {
        if (typeof Worker !== 'undefined') {
            this._worker.onmessage = async ({ data }) => {
                const event = data as SocketEvent;

                switch (event.type) {
                    case CommandType.TimeSynced:
                        const networkDelay = Math.trunc(event.RTT / 2);
                        const clientTimeStamp = new Date().getTime();
                        const serverTimeStamp = new Date(event.serverTime + event.tz).getTime();
                        const diff = serverTimeStamp - clientTimeStamp + networkDelay;
                        DateFactory.tz = event.tz;
                        DateFactory.correction = diff;
                        this._initialized$.next();
                        break;

                    case CommandType.Connected:
                        await this._restoreSession(this._messageRef != null);

                        if (this._messageRef != null) {
                            this.messageService.remove(this._messageRef.messageId);
                            this._messageRef = null;
                            this.messageService.success('Подключение восстановлено');
                        }
                        break;

                    case CommandType.ReceiveMessage:
                        this._subject$.next(JSON.parse(event.payload));
                        break;

                    case CommandType.ConnectionError:
                        if (this._messageRef == null) {
                            this._messageRef = this.messageService.warning(
                                'Соединение прервано, попытка переподключения...',
                                {
                                    nzDuration: 0,
                                }
                            );
                        }
                        this._ready$.next(false);
                        this._disconnected$.next();
                        break;
                }
            };

            this._subject$.pipe(untilDestroyed(this)).subscribe((message) => {
                message.forEach((e) => {
                    this._processActions(e);
                });
            });

            this._worker.postMessage(
                new OpenConnection(
                    this._wsReconnectTimeout,
                    environment.wsUrl,
                    this._healthCheckTimeout
                )
            );
        } else {
            this._error$.next('Неподдерживаемый браузер');
        }
    }

    /**
     * REPLAY MODE: Modified to support message interception
     */
    private _sendMessage(request: RequestObject): void {
        const requestData = JSON.stringify(request);

        // REPLAY MODE: Check if this message should be intercepted
        const replayResponse = this.wsReplayService.getReplayResponse(requestData);

        if (replayResponse) {
            // Message was intercepted - simulate the response
            if (environment.debug) {
                this.storeDebugService.registerMessage(request);
            }

            // Parse and emit the replayed response after a short delay
            setTimeout(() => {
                try {
                    const actions = JSON.parse(replayResponse) as ActionObject[];
                    
                    // Register in debug service
                    if (environment.debug) {
                        actions.forEach(action => this.storeDebugService.registerMessage(action));
                    }
                    
                    // Emit to subject as if it came from the WebSocket
                    this._subject$.next(actions);
                } catch (error) {
                    console.error('Failed to parse replay response:', error);
                }
            }, 100); // Small delay to simulate network latency

            return; // Don't send to actual WebSocket
        }

        // REPLAY MODE: Normal flow - capture sent message and send to WebSocket
        if (environment.debug) {
            this.storeDebugService.registerMessage(request);
            this.wsReplayService.addMessageToHistory('sent', requestData);
        }

        this._worker.postMessage(new SendMessage(requestData));
    }
}
