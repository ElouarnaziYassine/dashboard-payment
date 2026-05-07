import { Component, OnInit, OnDestroy, ViewEncapsulation, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { WebsocketService } from '../websocket';
import { TestControlService } from '../test-control';
import { Subscription } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  encapsulation: ViewEncapsulation.None
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {

  connected = false;
  testRunning = false;
  selectedTest = 'card-authorization';
  availableTests: any[] = [];
  alerts: any[] = [];
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
  private pendingResults: any[] = [];
  private chartUpdateTimer: any = null;
  private throughputChart: Chart | null = null;
  private requestTimestamps: number[] = [];
  private alertIdCounter = 0;

  constructor(
    private wsService: WebsocketService,
    private testControl: TestControlService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.wsService.connect();
    this.testControl.getTests().subscribe(tests => {
      this.availableTests = tests;  
    });

    this.subs.push(
      this.wsService.connected$.subscribe(status => {
        this.connected = status;
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      this.wsService.results$.subscribe(result => {
        // Handle system messages
        if (result.status === 'TEST_STARTED') {
          this.testRunning = true;
          this.resetMetrics();
          this.cdr.detectChanges();
          return;
        }
        if (result.status === 'TEST_STOPPED') {
          this.testRunning = false;
          this.cdr.detectChanges();
          return;
        }

        // Handle normal test results
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
  this.initThroughputChart();
}

  startTest(): void {
    this.testControl.startTest(this.selectedTest).subscribe({
      next: (res) => {
        if (res.success) {
          this.testRunning = true;
          this.resetMetrics();
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to start test', err)
    });
  }

  stopTest(): void {
    this.testControl.stopTest().subscribe({
      next: (res) => {
        if (res.success) {
          this.testRunning = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to stop test', err)
    });
  }

  addAlert(type: string, title: string, message: string): void {
  const id = this.alertIdCounter++;
  this.alerts.push({ id, type, title, message });

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      this.dismissAlert(id);
      this.cdr.detectChanges();
    }, 5000);
  }

  dismissAlert(id: number): void {
    this.alerts = this.alerts.filter(a => a.id !== id);
  }

  resetMetrics(): void {
    this.metrics = {
      total: 0,
      approved: 0,
      declined: 0,
      approvalRate: 0,
      declineRate: 0,
      avgResponseTime: 0,
      slaBreaches: 0,
      failedAssertions: 0
    };
    this.requestTimestamps = [];
    if (this.throughputChart) {
      this.throughputChart.data.labels = [];
      this.throughputChart.data.datasets[0].data = [];
      this.throughputChart.update();
    }
    if (this.responseTimeChart) {
      this.responseTimeChart.data.labels = [];
      this.responseTimeChart.data.datasets[0].data = [];
      this.responseTimeChart.update();
    }
    if (this.statusChart) {
      this.statusChart.data.datasets[0].data = [0, 0];
      this.statusChart.update();
    }
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
        plugins: { legend: { display: false } },
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
          borderColor: ['#3fb950', '#f85149'],
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

  initThroughputChart(): void {
  const canvas = document.getElementById('throughputChart') as HTMLCanvasElement;
  if (!canvas) return;

  this.throughputChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Requests/sec',
        data: [],
        borderColor: '#3fb950',
        backgroundColor: 'rgba(63, 185, 80, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#3fb950',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
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

  updateCharts(result: any): void {
  this.pendingResults.push(result);

  if (this.chartUpdateTimer) return;

  this.chartUpdateTimer = setTimeout(() => {
    this.flushChartUpdates();
    this.chartUpdateTimer = null;
  }, 500);
}

flushChartUpdates(): void {
  if (!this.pendingResults.length) return;

  if (this.responseTimeChart) {
    const labels = this.responseTimeChart.data.labels as string[];
    const data   = this.responseTimeChart.data.datasets[0].data as number[];
    this.pendingResults.forEach(r => {
      labels.push(new Date(r.timestamp).toLocaleTimeString());
      data.push(r.responseTime);
    });
    while (labels.length > 30) { labels.shift(); data.shift(); }
    this.responseTimeChart.update('none');
  }

  if (this.statusChart) {
    this.statusChart.data.datasets[0].data = [
      this.metrics.approved,
      this.metrics.declined
    ];
    this.statusChart.update('none');
  }

  if (this.throughputChart) {
    this.pendingResults.forEach(r => {
      this.requestTimestamps.push(new Date(r.timestamp).getTime());
    });

    const cutoff = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > cutoff);

    const buckets: Map<string, number> = new Map();
    this.requestTimestamps.forEach(t => {
      const key = new Date(t).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    const sortedKeys = Array.from(buckets.keys()).sort();
    const labels = sortedKeys.slice(-15);
    const data   = labels.map(k => buckets.get(k) || 0);

    this.throughputChart.data.labels = labels;
    this.throughputChart.data.datasets[0].data = data;
    this.throughputChart.update('none');
  }

  // Clear AFTER all charts have used the data
  this.pendingResults = [];
}

  addTransaction(result: any): void {
    this.transactions.unshift(result);
    if (this.transactions.length > 100) this.transactions.pop();
  }

  updateMetrics(result: any): void {
  this.metrics.total++;
  if (result.status === 'APPROVED' || result.status === 'SUCCESS') this.metrics.approved++;
  if (result.status === 'DECLINED') this.metrics.declined++;
  if (result.slaBreached) {
    this.metrics.slaBreaches++;
    this.addAlert('danger', 'SLA Breach Detected',
      `Request exceeded 2000ms — ${result.responseTime}ms | Card: ${result.maskedCard}`);
  }
  if (!result.assertionPassed) {
    this.metrics.failedAssertions++;
    this.addAlert('danger', 'Assertion Failed',
      `${result.testName} | Card: ${result.maskedCard} | Status: ${result.status}`);
  }

  const total = this.metrics.total;
  this.metrics.approvalRate = Math.round((this.metrics.approved / total) * 100);
  this.metrics.declineRate  = Math.round((this.metrics.declined / total) * 100);

  // Warn if decline rate exceeds 50%
  if (total > 10 && this.metrics.declineRate > 50) {
    if (this.alerts.filter(a => a.title === 'High Decline Rate').length === 0) {
      this.addAlert('warning', 'High Decline Rate',
        `${this.metrics.declineRate}% of transactions are being declined`);
    }
  }

  const totalTime = this.transactions.reduce((sum, t) => sum + t.responseTime, 0);
  this.metrics.avgResponseTime = Math.round(totalTime / this.transactions.length);
}

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.wsService.disconnect();
    if (this.responseTimeChart) this.responseTimeChart.destroy();
if (this.throughputChart) this.throughputChart.destroy();  }
}