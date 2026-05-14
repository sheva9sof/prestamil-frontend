# Session Warning Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a countdown modal 3 minutes before session expiry with options to extend or logout; both timeouts configurable from the existing Parámetros del Sistema CRUD.

**Architecture:** The backend reads both timeout values from `parametros_sistema` at login time and returns them in `LoginResponse`. A new `SessionWarningService` on the frontend maintains a client-side timer reset by every successful HTTP response (via the existing credentials interceptor), shows a modal when the warning threshold is reached, and calls `GET /auth/keep-alive` to extend the session. The modal component subscribes to the service state and handles user interaction.

**Tech Stack:** Spring Boot (Spring Session JDBC, JPA), Angular 17 standalone components, Bootstrap 5, NgRx-free RxJS observables, Karma/Jasmine for frontend tests, Mockito for backend tests.

---

## File Map

**Backend — Create:**
- `prestamil-backend/src/main/resources/db/changelog/changes/003-session-params.sql`
- `prestamil-backend/src/main/java/com/ignis/prestamil/config/SessionTimeoutListener.java`

**Backend — Modify:**
- `prestamil-backend/src/main/resources/db/changelog/db.changelog-master.xml`
- `prestamil-backend/src/main/java/com/ignis/prestamil/response/LoginResponse.java`
- `prestamil-backend/src/main/java/com/ignis/prestamil/service/UsuarioService.java`
- `prestamil-backend/src/main/java/com/ignis/prestamil/controller/AuthController.java`

**Frontend — Create:**
- `prestamil-frontend/src/app/prestamil/core/services/session-warning.service.ts`
- `prestamil-frontend/src/app/prestamil/core/services/session-warning.service.spec.ts`
- `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.ts`
- `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.html`
- `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.scss`

**Frontend — Modify:**
- `prestamil-frontend/src/app/prestamil/core/models/auth-response.model.ts`
- `prestamil-frontend/src/app/prestamil/core/interceptors/credentials.interceptor.ts`
- `prestamil-frontend/src/app/prestamil/core/services/auth.service.ts`
- `prestamil-frontend/src/app/theme/layout/admin/admin.component.ts`
- `prestamil-frontend/src/app/theme/layout/admin/admin.component.html`
- `prestamil-frontend/src/app/theme/layout/admin/admin.component.scss`

---

## Task 1: Liquibase migration — parametros_sistema

**Files:**
- Create: `prestamil-backend/src/main/resources/db/changelog/changes/003-session-params.sql`
- Modify: `prestamil-backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Create migration file**

Create `prestamil-backend/src/main/resources/db/changelog/changes/003-session-params.sql`:

```sql
--liquibase formatted sql

--changeset emmanuel:003-session-params comment:Add session timeout configurable parameters

INSERT INTO `parametros_sistema` (`id`, `descripcion`, `valor_cadena`, `valor_numerico`, `tipo_dato_interfaz`) VALUES
(6, 'Tiempo de sesión (minutos)', NULL, 30.00, 'number'),
(7, 'Minutos de aviso antes de expirar sesión', NULL, 3.00, 'number');
```

- [ ] **Step 2: Include migration in master changelog**

Edit `prestamil-backend/src/main/resources/db/changelog/db.changelog-master.xml`. Add the include line after the 002 include:

```xml
    <include file="db/changelog/changes/003-session-params.sql"/>
```

The file should look like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        https://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

    <include file="db/changelog/changes/001-initial-schema.sql"/>
    <include file="db/changelog/changes/002-initial-data.sql"/>
    <include file="db/changelog/changes/003-session-params.sql"/>

</databaseChangeLog>
```

- [ ] **Step 3: Verify migration runs**

Start the backend and check the logs for Liquibase output:

```bash
cd prestamil-backend
./mvnw spring-boot:run
```

Expected in logs: `ChangeSet db/changelog/changes/003-session-params.sql::003-session-params::emmanuel ran successfully`

Also verify in DB: `SELECT * FROM parametros_sistema WHERE id IN (6, 7);` should return 2 rows.

- [ ] **Step 4: Commit**

```bash
cd prestamil-backend
git add src/main/resources/db/changelog/
git commit -m "feat: add session timeout configurable parameters to parametros_sistema"
```

---

## Task 2: Extend LoginResponse DTO (backend)

**Files:**
- Modify: `prestamil-backend/src/main/java/com/ignis/prestamil/response/LoginResponse.java`

- [ ] **Step 1: Add two fields to LoginResponse**

Open `prestamil-backend/src/main/java/com/ignis/prestamil/response/LoginResponse.java`. Add these two fields after the existing `opciones` field:

```java
private int sessionTimeoutMinutes = 30;
private int warningMinutes = 3;
```

The full file becomes:

```java
package com.ignis.prestamil.response;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public class LoginResponse {
    private Integer id;
    private String username;
    private String password;
    private String nombre;
    private String apellidos;
    private Boolean estatus;
    private Boolean cambiarPassword;
    private LocalDateTime ultimoLogin;
    private Integer idRol;
    private LocalDate fechaIni;
    private LocalDate fechaFin;
    private Boolean vigencia;
    private Boolean aplicaCambioPassword;
    private LocalDate fechaCambioPass;
    private Boolean editable;
    private LocalDateTime ultimaActividad;
    private LocalDateTime inicioSesion;
    private List<MenuResponse> opciones;
    private int sessionTimeoutMinutes = 30;
    private int warningMinutes = 3;
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd prestamil-backend
./mvnw compile -q
```

Expected: `BUILD SUCCESS` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/ignis/prestamil/response/LoginResponse.java
git commit -m "feat: add sessionTimeoutMinutes and warningMinutes to LoginResponse"
```

---

## Task 3: Populate session config in UsuarioService.login()

**Files:**
- Modify: `prestamil-backend/src/main/java/com/ignis/prestamil/service/UsuarioService.java`

- [ ] **Step 1: Add ParametrosSistemaRepository to UsuarioService constructor**

In `UsuarioService.java`, add the field declaration after `configuracionService`:

```java
private final ParametrosSistemaRepository parametrosSistemaRepository;
```

Add the import at the top of the file:

```java
import com.ignis.prestamil.repository.ParametrosSistemaRepository;
```

Replace the constructor with:

```java
public UsuarioService(UsuarioRepository repository, Encryptor encryptor, UsuarioMapper usuarioMapper,
                      RolRepository rolRepository, TurnoService turnoService,
                      ConfiguracionService configuracionService,
                      ParametrosSistemaRepository parametrosSistemaRepository) {
    super(repository);
    this.encryptor = encryptor;
    this.usuarioMapper = usuarioMapper;
    this.rolRepository = rolRepository;
    this.turnoService = turnoService;
    this.configuracionService = configuracionService;
    this.parametrosSistemaRepository = parametrosSistemaRepository;
}
```

- [ ] **Step 2: Populate new fields at end of login() method**

In `login()`, after `response.setOpciones(construirMenuJerarquico(opciones));`, add:

```java
int sessionTimeoutMinutes = parametrosSistemaRepository.findById(6)
    .map(p -> p.getValorNumerico() != null ? p.getValorNumerico().intValue() : 30)
    .orElse(30);
int warningMinutes = parametrosSistemaRepository.findById(7)
    .map(p -> p.getValorNumerico() != null ? p.getValorNumerico().intValue() : 3)
    .orElse(3);
response.setSessionTimeoutMinutes(sessionTimeoutMinutes);
response.setWarningMinutes(warningMinutes);
```

The end of the `login()` method should look like:

```java
LoginResponse response = usuarioMapper.toLoginResponse(usuario, opciones);
response.setOpciones(construirMenuJerarquico(opciones));

int sessionTimeoutMinutes = parametrosSistemaRepository.findById(6)
    .map(p -> p.getValorNumerico() != null ? p.getValorNumerico().intValue() : 30)
    .orElse(30);
int warningMinutes = parametrosSistemaRepository.findById(7)
    .map(p -> p.getValorNumerico() != null ? p.getValorNumerico().intValue() : 3)
    .orElse(3);
response.setSessionTimeoutMinutes(sessionTimeoutMinutes);
response.setWarningMinutes(warningMinutes);

return response;
```

- [ ] **Step 3: Verify compilation**

```bash
cd prestamil-backend
./mvnw compile -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Manual smoke test**

With backend running and DB migrated (Task 1 done), call the login endpoint:

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c /tmp/cookies.txt -s | python -m json.tool | grep -E "sessionTimeout|warning"
```

Expected output includes:
```json
"sessionTimeoutMinutes": 30,
"warningMinutes": 3,
```

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/ignis/prestamil/service/UsuarioService.java
git commit -m "feat: populate session config from parametros_sistema in login response"
```

---

## Task 4: SessionTimeoutListener (backend)

**Files:**
- Create: `prestamil-backend/src/main/java/com/ignis/prestamil/config/SessionTimeoutListener.java`

- [ ] **Step 1: Write the failing test**

Create `prestamil-backend/src/test/java/com/ignis/prestamil/config/SessionTimeoutListenerTest.java`:

```java
package com.ignis.prestamil.config;

import com.ignis.prestamil.model.ParametrosSistema;
import com.ignis.prestamil.repository.ParametrosSistemaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.session.MapSession;
import org.springframework.session.events.SessionCreatedEvent;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionTimeoutListenerTest {

    @Mock
    private ParametrosSistemaRepository parametrosSistemaRepository;

    @InjectMocks
    private SessionTimeoutListener sessionTimeoutListener;

    private ParametrosSistema param6;

    @BeforeEach
    void setUp() {
        param6 = new ParametrosSistema();
        param6.setId(6);
        param6.setValorNumerico(new BigDecimal("45"));
    }

    @Test
    void setsMaxInactiveIntervalFromDb() {
        when(parametrosSistemaRepository.findById(6)).thenReturn(Optional.of(param6));

        MapSession session = new MapSession();
        SessionCreatedEvent event = new SessionCreatedEvent(this, session);

        sessionTimeoutListener.onApplicationEvent(event);

        assertEquals(Duration.ofMinutes(45), session.getMaxInactiveInterval());
    }

    @Test
    void usesDefaultOf30MinutesWhenParamMissing() {
        when(parametrosSistemaRepository.findById(6)).thenReturn(Optional.empty());

        MapSession session = new MapSession();
        SessionCreatedEvent event = new SessionCreatedEvent(this, session);

        sessionTimeoutListener.onApplicationEvent(event);

        assertEquals(Duration.ofMinutes(30), session.getMaxInactiveInterval());
    }
}
```

- [ ] **Step 2: Run failing test**

```bash
cd prestamil-backend
./mvnw test -Dtest=SessionTimeoutListenerTest -q
```

Expected: FAIL — `SessionTimeoutListener` does not exist yet.

- [ ] **Step 3: Create SessionTimeoutListener**

Create `prestamil-backend/src/main/java/com/ignis/prestamil/config/SessionTimeoutListener.java`:

```java
package com.ignis.prestamil.config;

import com.ignis.prestamil.repository.ParametrosSistemaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationListener;
import org.springframework.session.Session;
import org.springframework.session.events.SessionCreatedEvent;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class SessionTimeoutListener implements ApplicationListener<SessionCreatedEvent> {

    @Autowired
    private ParametrosSistemaRepository parametrosSistemaRepository;

    @Override
    public void onApplicationEvent(SessionCreatedEvent event) {
        int minutes = parametrosSistemaRepository.findById(6)
            .map(p -> p.getValorNumerico() != null ? p.getValorNumerico().intValue() : 30)
            .orElse(30);
        Session session = event.getSession();
        session.setMaxInactiveInterval(Duration.ofMinutes(minutes));
    }
}
```

- [ ] **Step 4: Run test again**

```bash
cd prestamil-backend
./mvnw test -Dtest=SessionTimeoutListenerTest -q
```

Expected: `BUILD SUCCESS`, 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/ignis/prestamil/config/SessionTimeoutListener.java \
        src/test/java/com/ignis/prestamil/config/SessionTimeoutListenerTest.java
git commit -m "feat: apply dynamic session timeout from parametros_sistema on session creation"
```

---

## Task 5: Add /auth/keep-alive endpoint (backend)

**Files:**
- Modify: `prestamil-backend/src/main/java/com/ignis/prestamil/controller/AuthController.java`

- [ ] **Step 1: Add the keep-alive endpoint**

In `AuthController.java`, add the following import if not present:

```java
import org.springframework.web.bind.annotation.GetMapping;
```

Add this method after the `logout()` method:

```java
@GetMapping("/keep-alive")
public ResponseEntity<Void> keepAlive() {
    return ResponseEntity.ok().build();
}
```

- [ ] **Step 2: Verify compilation and test manually**

```bash
cd prestamil-backend
./mvnw compile -q
```

Expected: `BUILD SUCCESS`

With backend running, test keep-alive with a valid session:

```bash
# First login to get cookie
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c /tmp/cookies.txt -s > /dev/null

# Call keep-alive with session cookie
curl -X GET http://localhost:8080/auth/keep-alive \
  -b /tmp/cookies.txt -v 2>&1 | grep "< HTTP"
```

Expected: `< HTTP/1.1 200`

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/ignis/prestamil/controller/AuthController.java
git commit -m "feat: add GET /auth/keep-alive endpoint for session extension"
```

---

## Task 6: Extend auth-response model (frontend)

**Files:**
- Modify: `prestamil-frontend/src/app/prestamil/core/models/auth-response.model.ts`

- [ ] **Step 1: Add session config fields to LoginResponse interface**

Open `prestamil-frontend/src/app/prestamil/core/models/auth-response.model.ts`.

Add these two optional fields at the end of the `LoginResponse` interface, before the closing `}`:

```typescript
sessionTimeoutMinutes?: number;
warningMinutes?: number;
```

The interface bottom becomes:

```typescript
export interface LoginResponse {
  // ... existing fields ...
  opciones: OpcionMenu[];
  token: string;
  sessionTimeoutMinutes?: number;
  warningMinutes?: number;
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd prestamil-frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/prestamil/core/models/auth-response.model.ts
git commit -m "feat: add sessionTimeoutMinutes and warningMinutes to LoginResponse interface"
```

---

## Task 7: Create SessionWarningService (frontend)

**Files:**
- Create: `prestamil-frontend/src/app/prestamil/core/services/session-warning.service.ts`
- Create: `prestamil-frontend/src/app/prestamil/core/services/session-warning.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `prestamil-frontend/src/app/prestamil/core/services/session-warning.service.spec.ts`:

```typescript
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
    // Advance past warning threshold: 1min - 3s = 57s
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
```

- [ ] **Step 2: Run failing tests**

```bash
cd prestamil-frontend
ng test --include="**/session-warning.service.spec.ts" --watch=false
```

Expected: FAIL — `SessionWarningService` not found.

- [ ] **Step 3: Create SessionWarningService**

Create `prestamil-frontend/src/app/prestamil/core/services/session-warning.service.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests again**

```bash
cd prestamil-frontend
ng test --include="**/session-warning.service.spec.ts" --watch=false
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/prestamil/core/services/session-warning.service.ts \
        src/app/prestamil/core/services/session-warning.service.spec.ts
git commit -m "feat: add SessionWarningService with countdown timer and keep-alive"
```

---

## Task 8: Update CredentialsInterceptor (frontend)

**Files:**
- Modify: `prestamil-frontend/src/app/prestamil/core/interceptors/credentials.interceptor.ts`

The interceptor injects `SessionWarningService` lazily via `Injector` to avoid a circular dependency (`CredentialsInterceptor` → `SessionWarningService` → `HttpClient` → interceptors → `CredentialsInterceptor`).

- [ ] **Step 1: Replace the full interceptor file**

Replace `prestamil-frontend/src/app/prestamil/core/interceptors/credentials.interceptor.ts` with:

```typescript
import { Injectable, Injector, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { SessionWarningService } from '../services/session-warning.service';

const EXCLUDED_ACTIVITY_URLS = [
  `${environment.apiUrl}/auth/logout`,
];

@Injectable()
export class CredentialsInterceptor implements HttpInterceptor {
  private injector = inject(Injector);
  private _sessionWarningService: SessionWarningService | null = null;

  private get sessionWarningService(): SessionWarningService {
    if (!this._sessionWarningService) {
      this._sessionWarningService = this.injector.get(SessionWarningService);
    }
    return this._sessionWarningService;
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isBackendRequest = req.url.startsWith(environment.apiUrl);

    if (!isBackendRequest || req.withCredentials) {
      return next.handle(req);
    }

    const credentialRequest = req.clone({ withCredentials: true });

    if (!environment.production) {
      console.debug('[CredentialsInterceptor] withCredentials=true', credentialRequest.method, credentialRequest.url);
    }

    const shouldRecord = !EXCLUDED_ACTIVITY_URLS.some(url => req.url.startsWith(url));

    return next.handle(credentialRequest).pipe(
      tap(event => {
        if (shouldRecord && event instanceof HttpResponse) {
          this.sessionWarningService.recordActivity();
        }
      })
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd prestamil-frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/prestamil/core/interceptors/credentials.interceptor.ts
git commit -m "feat: notify SessionWarningService of activity on each successful HTTP response"
```

---

## Task 9: Update AuthService (frontend)

**Files:**
- Modify: `prestamil-frontend/src/app/prestamil/core/services/auth.service.ts`

- [ ] **Step 1: Inject SessionWarningService in AuthService**

In `auth.service.ts`, add the import at the top:

```typescript
import { SessionWarningService } from './session-warning.service';
```

Add the injection inside the class body (after the existing `authStreamService` inject):

```typescript
private sessionWarningService = inject(SessionWarningService);
```

- [ ] **Step 2: Call initialize() in setSession()**

In `setSession()`, after `this.authStreamService.connect(nombreUsuario)`, add:

```typescript
const timeoutMinutes = loginResponse.sessionTimeoutMinutes ?? 30;
const warningMinutes = loginResponse.warningMinutes ?? 3;
this.sessionWarningService.initialize(timeoutMinutes, warningMinutes);
```

The end of `setSession()` should look like:

```typescript
if (nombreUsuario) {
  console.log('[AuthService] Conectando SSE para usuario:', nombreUsuario);
  this.authStreamService.connect(nombreUsuario);
  const timeoutMinutes = loginResponse.sessionTimeoutMinutes ?? 30;
  const warningMinutes = loginResponse.warningMinutes ?? 3;
  this.sessionWarningService.initialize(timeoutMinutes, warningMinutes);
}
```

- [ ] **Step 3: Call stop() at start of clearLocalSession()**

In `clearLocalSession()`, add as the first line:

```typescript
this.sessionWarningService.stop();
```

The method becomes:

```typescript
private clearLocalSession(): void {
  this.sessionWarningService.stop();
  this.authStreamService.disconnect();
  localStorage.removeItem(this.AUTH_USER_KEY);
  localStorage.removeItem(this.MENU_ITEMS_KEY);
  this.isAuthenticatedSubject.next(false);
  this.menuItemsSubject.next([]);
}
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd prestamil-frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/prestamil/core/services/auth.service.ts
git commit -m "feat: wire SessionWarningService into AuthService login/logout lifecycle"
```

---

## Task 10: Create SessionWarningModalComponent (frontend)

**Files:**
- Create: `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.ts`
- Create: `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.html`
- Create: `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Create `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.ts`:

```typescript
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
```

- [ ] **Step 2: Create the component template**

Create `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.html`:

```html
<ng-container *ngIf="warningState$ | async as state">
  <div *ngIf="state.show" class="session-warning-overlay" role="dialog" aria-modal="true" aria-labelledby="sessionWarningTitle">
    <div class="session-warning-dialog">
      <div class="session-warning-header">
        <i class="feather icon-clock text-warning" style="font-size: 2rem;"></i>
        <h5 id="sessionWarningTitle" class="mt-2 mb-0">Sesión por expirar</h5>
      </div>

      <div class="session-warning-body">
        <p class="text-muted mb-1">La sesión se cerrará en</p>
        <div class="countdown" [class.countdown-urgent]="state.secondsRemaining <= 30">
          {{ formatTime(state.secondsRemaining) }}
        </div>
        <p class="text-muted mt-1">¿Deseas continuar?</p>
      </div>

      <div class="session-warning-footer">
        <button
          class="btn btn-primary"
          (click)="extendSession()"
          [disabled]="isExtending"
        >
          <span *ngIf="isExtending" class="spinner-border spinner-border-sm me-1" role="status"></span>
          Extender sesión
        </button>
        <button class="btn btn-outline-secondary" (click)="logout()">
          Cerrar sesión
        </button>
      </div>
    </div>
  </div>
</ng-container>
```

- [ ] **Step 3: Create the component styles**

Create `prestamil-frontend/src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component.scss`:

```scss
.session-warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9998;
  backdrop-filter: blur(3px);
}

.session-warning-dialog {
  background: #fff;
  border-radius: 12px;
  padding: 2rem;
  width: 360px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.session-warning-header {
  margin-bottom: 1rem;
}

.countdown {
  font-size: 3rem;
  font-weight: 700;
  color: #f0a500;
  margin: 0.5rem 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
  transition: color 0.3s;

  &.countdown-urgent {
    color: #e74c3c;
  }
}

.session-warning-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1.5rem;

  button {
    min-width: 130px;
  }
}
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd prestamil-frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/prestamil/core/components/session-warning-modal/
git commit -m "feat: add SessionWarningModalComponent with countdown and extend/logout actions"
```

---

## Task 11: Wire SessionWarningModalComponent into AdminComponent (frontend)

**Files:**
- Modify: `prestamil-frontend/src/app/theme/layout/admin/admin.component.ts`
- Modify: `prestamil-frontend/src/app/theme/layout/admin/admin.component.html`

- [ ] **Step 1: Import SessionWarningModalComponent in AdminComponent**

In `prestamil-frontend/src/app/theme/layout/admin/admin.component.ts`, add the import statement:

```typescript
import { SessionWarningModalComponent } from 'src/app/prestamil/core/components/session-warning-modal/session-warning-modal.component';
```

Add `SessionWarningModalComponent` to the `imports` array in `@Component`:

```typescript
@Component({
  selector: 'app-admin',
  imports: [
    NavBarComponent,
    NavigationComponent,
    RouterModule,
    CommonModule,
    ConfigurationComponent,
    BreadcrumbsComponent,
    Footer,
    SessionWarningModalComponent
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
```

- [ ] **Step 2: Add component tag to template**

In `prestamil-frontend/src/app/theme/layout/admin/admin.component.html`, add the modal component tag after the logout overlay div and before the main container div:

```html
<!-- Session warning modal -->
<app-session-warning-modal />
```

The relevant part of the template should look like:

```html
<!-- Spinner de logout -->
<div *ngIf="isLoggingOut" class="logout-overlay">
  <div class="logout-spinner-container">
    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
      <span class="visually-hidden">Cerrando sesión...</span>
    </div>
    <p class="mt-3 text-white">Cerrando sesión...</p>
  </div>
</div>

<!-- Session warning modal -->
<app-session-warning-modal />

<div class="pcoded-main-container">
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd prestamil-frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Build for production to catch any remaining issues**

```bash
cd prestamil-frontend
ng build --configuration production 2>&1 | tail -20
```

Expected: `✔ Browser application bundle generation complete.` with no errors.

- [ ] **Step 5: Manual end-to-end smoke test**

1. Start backend: `./mvnw spring-boot:run` (from `prestamil-backend/`)
2. Start frontend: `ng serve` (from `prestamil-frontend/`)
3. Login with valid credentials
4. Open DevTools console and run: `localStorage.getItem('authUser')` — confirm user is saved
5. To trigger the warning without waiting 27 minutes, open DevTools and run:

```javascript
// Simulate that the last request was 27 minutes ago
const svc = window.ng.getComponent(document.querySelector('app-session-warning-modal'));
```

Or alternatively, temporarily change the timeout in `initialize()` to 1 minute / 3 second warning for testing, login, wait 57 seconds.

6. Confirm modal appears with countdown
7. Click "Extender sesión" — confirm modal closes and countdown resets
8. Wait again for modal — click "Cerrar sesión" — confirm redirect to login

- [ ] **Step 6: Commit**

```bash
git add src/app/theme/layout/admin/admin.component.ts \
        src/app/theme/layout/admin/admin.component.html
git commit -m "feat: integrate session warning modal into admin layout"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Warning 3 min before expiry (configurable) | Task 1 (DB), Task 7 (service threshold) |
| Session timeout configurable | Task 1 (DB), Task 4 (listener) |
| Both values from parametros_sistema CRUD | Task 1 (rows visible in existing CRUD) |
| Backend returns values at login | Task 2, 3 |
| Only explicit button resets timer | Task 7 (recordActivity ≠ hideWarning) |
| Keep-alive endpoint | Task 5 |
| Countdown modal with extend/logout | Task 10 |
| Auto-logout at secondsRemaining=0 | Task 10 (ngOnInit subscription) |
| Timer stops on logout | Task 9 (clearLocalSession → stop()) |
| Modal in admin layout | Task 11 |

All spec requirements covered.

**Type consistency check:** `SessionWarningState` interface defined in Task 7 and used consistently in Tasks 8, 9, 10, 11. `extendSession()` returns `Observable<void>` consistently between definition (Task 7) and usage (Task 10). `recordActivity()` called in Task 8 interceptor and Task 7 service.

**Placeholder scan:** No TBDs. All code blocks complete. All commands include expected output.
