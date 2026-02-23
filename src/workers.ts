import { AegisService } from './services/aegis';

export class WorkerScheduler {
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(private readonly service: AegisService) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    this.timers.push(setInterval(() => void this.safeRun('expirePendingActions', () => this.service.expirePendingActions()), 1000));
    this.timers.push(setInterval(() => void this.safeRun('processApprovedActions', () => this.service.processApprovedActions()), 750));
    this.timers.push(setInterval(() => void this.safeRun('dispatchDueWebhooks', () => this.service.dispatchDueWebhooks()), 1000));
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    this.running = false;
  }

  private async safeRun(name: string, fn: () => number | Promise<number>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      console.error(`[worker:${name}]`, error);
    }
  }
}
