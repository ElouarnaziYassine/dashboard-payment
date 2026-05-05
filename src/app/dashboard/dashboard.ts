import { Component, OnInit, OnDestroy, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { WebsocketService } from '../websocket';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  encapsulation: ViewEncapsulation.None
})
export class Dashboard implements OnInit, OnDestroy {

  connected = false;
  transactions: any[] = [];
  metrics = {
    total: 0,
    approved: 0,
    declined: 0,
    approvalRate: 0,
    declineRate: 0,
    avgResponseTime: 0,
    slaBreaches: 0,
    failedAssertions: 0
  };

  private subs: Subscription[] = [];

  constructor(
    private wsService: WebsocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.wsService.connect();

    this.subs.push(
      this.wsService.connected$.subscribe(status => {
        this.connected = status;
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      this.wsService.results$.subscribe(result => {
        this.addTransaction(result);
        this.updateMetrics(result);
        this.cdr.detectChanges();
      })
    );
  }

  addTransaction(result: any): void {
    this.transactions.unshift(result);
    if (this.transactions.length > 100) {
      this.transactions.pop();
    }
  }

  updateMetrics(result: any): void {
    this.metrics.total++;

    if (result.status === 'APPROVED') this.metrics.approved++;
    if (result.status === 'DECLINED') this.metrics.declined++;
    if (result.slaBreached) this.metrics.slaBreaches++;
    if (!result.assertionPassed) this.metrics.failedAssertions++;

    const total = this.metrics.total;
    this.metrics.approvalRate = Math.round((this.metrics.approved / total) * 100);
    this.metrics.declineRate  = Math.round((this.metrics.declined / total) * 100);

    const totalTime = this.transactions.reduce((sum, t) => sum + t.responseTime, 0);
    this.metrics.avgResponseTime = Math.round(totalTime / this.transactions.length);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.wsService.disconnect();
  }
}