import { Injectable } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {

  private client: Client;
  private subscription: StompSubscription | null = null;

public connected$ = new BehaviorSubject<boolean>(false);
  public results$ = new Subject<any>();

  constructor() {
    this.client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
  onConnect: () => {
    console.log('=== WEBSOCKET CONNECTED ===');
    this.connected$.next(true);
    this.subscription = this.client.subscribe('/topic/results', message => {
      const result = JSON.parse(message.body);
      this.results$.next(result);
    });
  },
  onDisconnect: () => {
    console.log('=== WEBSOCKET DISCONNECTED ===');
    this.connected$.next(false);
  },
  onStompError: () => {
    console.log('=== WEBSOCKET ERROR ===');
    this.connected$.next(false);
  },
  onWebSocketClose: () => {
    console.log('=== WEBSOCKET CLOSED ===');
    this.connected$.next(false);
  }
});
  }

  connect(): void {
    this.client.activate();
  }

  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.client.deactivate();
  }
}