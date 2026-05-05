import { Component, OnInit, OnDestroy, ViewEncapsulation, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { WebsocketService } from '../websocket';
import { Subscription } from 'rxjs';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  encapsulation: ViewEncapsulation.None
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {

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
  private responseTimeChart: Chart | null = null;
  private statusChart: Chart | null = null;

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
        this.updateCharts(result);
        this.cdr.detectChanges();
      })
    );
  }

  ngAfterViewInit(): void {
    this.initResponseTimeChart();
    this.initStatusChart();
  }

  initResponseTimeChart(): void {
    const canvas = document.getElementById('responseTimeChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.responseTimeChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Response Time (ms)',
          data: [],
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#58a6ff',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', maxTicksLimit: 10 },
            grid: { color: '#30363d' }
          },
          y: {
            ticks: { color: '#8b949e' },
            grid: { color: '#30363d' },
            beginAtZero: true
          }
        }
      }
    });
  }

  initStatusChart(): void {
    const canvas = document.getElementById('statusChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.statusChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Approved', 'Declined'],
        datasets: [{
          data: [0, 0],
          backgroundColor: [
            'rgba(63, 185, 80, 0.8)',
            'rgba(248, 81, 73, 0.8)'
          ],
          borderColor: [
            '#3fb950',
            '#f85149'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: '#8b949e', padding: 16, font: { size: 12 } }
          }
        }
      }
    });
  }

  updateCharts(result: any): void {
    // Response time chart
    if (this.responseTimeChart) {
      const labels = this.responseTimeChart.data.labels as string[];
      const data   = this.responseTimeChart.data.datasets[0].data as number[];

      labels.push(new Date(result.timestamp).toLocaleTimeString());
      data.push(result.responseTime);

      if (labels.length > 30) {
        labels.shift();
        data.shift();
      }

      this.responseTimeChart.update();
    }

    // Status donut chart
    if (this.statusChart) {
      this.statusChart.data.datasets[0].data = [
        this.metrics.approved,
        this.metrics.declined
      ];
      this.statusChart.update();
    }
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
    if (this.responseTimeChart) this.responseTimeChart.destroy();
    if (this.statusChart) this.statusChart.destroy();
  }
}