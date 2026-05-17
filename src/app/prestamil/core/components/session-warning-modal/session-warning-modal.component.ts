import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SessionWarningService } from '../../services/session-warning.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-session-warning-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-warning-modal.component.html',
  styleUrls: ['./session-warning-modal.component.scss']
})
export class SessionWarningModalComponent implements OnInit, OnDestroy {
  private sessionWarningService = inject(SessionWarningService);
  private authService = inject(AuthService);

  warningState$ = this.sessionWarningService.warningState$;
  isExtending = false;
  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.sub = this.sessionWarningService.warningState$.subscribe(state => {
      if (state.show && state.secondsRemaining === 0) {
        this.authService.handleSessionInvalidation(
          'La sesión expiró por inactividad. Por favor, inicia sesión nuevamente.'
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  extendSession(): void {
    this.isExtending = true;
    this.sessionWarningService.extendSession().subscribe({
      next: () => { this.isExtending = false; },
      error: () => { this.isExtending = false; }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
