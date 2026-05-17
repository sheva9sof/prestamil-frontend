import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SessionWarningService } from './session-warning.service';
import { environment } from 'src/environments/environment';

describe('SessionWarningService', () => {
  let service: SessionWarningService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SessionWarningService]
    });
    service = TestBed.inject(SessionWarningService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stop();
    httpMock.verify();
  });

  it('should not show warning immediately after initialize', fakeAsync(() => {
    service.initialize(30, 3);
    let state: any;
    service.warningState$.subscribe(s => state = s);
    tick(10_000);
    expect(state.show).toBeFalse();
    service.stop();
  }));

  it('should show warning when inactivity threshold is reached', fakeAsync(() => {
    service.initialize(1, 0.05); // 1 min session, 3s warning
    let state: any;
    service.warningState$.subscribe(s => state = s);
    // Advance past warning threshold: 60s - 3s = 57s, then check interval fires at 67s
    tick(57_000 + 10_000);
    expect(state.show).toBeTrue();
    expect(state.secondsRemaining).toBeGreaterThan(0);
    service.stop();
  }));

  it('should reset timer after recordActivity', fakeAsync(() => {
    service.initialize(1, 0.05);
    let state: any;
    service.warningState$.subscribe(s => state = s);
    tick(50_000);
    service.recordActivity();
    tick(10_000);
    expect(state.show).toBeFalse();
    service.stop();
  }));

  it('stop() hides warning and clears timers', fakeAsync(() => {
    service.initialize(30, 3);
    let state: any;
    service.warningState$.subscribe(s => state = s);
    service.stop();
    tick(60_000);
    expect(state.show).toBeFalse();
  }));

  it('extendSession() calls keep-alive and hides modal', fakeAsync(() => {
    service.initialize(1, 0.05);
    let state: any;
    service.warningState$.subscribe(s => state = s);
    tick(57_000 + 10_000);
    expect(state.show).toBeTrue();

    service.extendSession().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/keep-alive`);
    req.flush(null);
    tick();

    expect(state.show).toBeFalse();
    service.stop();
  }));
});
