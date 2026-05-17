import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface SessionWarningState {
  show: boolean;
  secondsRemaining: number;
}

@Injectable({ providedIn: 'root' })
export class SessionWarningService {
  private http = inject(HttpClient);

  private sessionTimeoutMs = 30 * 60 * 1000;
  private warningBeforeMs = 3 * 60 * 1000;
  private lastRequestTime = Date.now();

  private readonly warningStateSubject = new BehaviorSubject<SessionWarningState>({
    show: false,
    secondsRemaining: 0
  });
  public readonly warningState$ = this.warningStateSubject.asObservable();

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  initialize(sessionTimeoutMinutes: number, warningMinutes: number): void {
    this.sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;
    this.warningBeforeMs = warningMinutes * 60 * 1000;
    this.lastRequestTime = Date.now();
    this.startCheckTimer();
  }

  recordActivity(): void {
    this.lastRequestTime = Date.now();
  }

  extendSession(): Observable<void> {
    return this.http.get<void>(`${environment.apiUrl}/auth/keep-alive`, { withCredentials: true }).pipe(
      tap(() => {
        this.recordActivity();
        this.hideWarning();
      })
    );
  }

  stop(): void {
    this.clearTimers();
    this.warningStateSubject.next({ show: false, secondsRemaining: 0 });
  }

  private startCheckTimer(): void {
    this.clearTimers();
    this.checkInterval = setInterval(() => {
      if (this.warningStateSubject.value.show) return;
      const elapsed = Date.now() - this.lastRequestTime;
      const timeUntilExpiry = this.sessionTimeoutMs - elapsed;
      if (timeUntilExpiry <= this.warningBeforeMs) {
        this.showWarning(Math.max(0, Math.floor(timeUntilExpiry / 1000)));
      }
    }, 10_000);
  }

  private showWarning(secondsRemaining: number): void {
    this.warningStateSubject.next({ show: true, secondsRemaining });
    this.countdownInterval = setInterval(() => {
      const current = this.warningStateSubject.value;
      this.warningStateSubject.next({
        show: true,
        secondsRemaining: Math.max(0, current.secondsRemaining - 1)
      });
    }, 1000);
  }

  private hideWarning(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.warningStateSubject.next({ show: false, secondsRemaining: 0 });
    this.startCheckTimer();
  }

  private clearTimers(): void {
    if (this.checkInterval) { clearInterval(this.checkInterval); this.checkInterval = null; }
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }
}
