# Session Warning Modal — Design Spec

**Date:** 2026-05-14
**Status:** Approved

## Context

The backend uses Spring Session JDBC with a 30-minute session timeout (stateful, HttpOnly cookie). The frontend currently handles expiration reactively — it only detects it when the backend returns 401/403. There is no proactive warning. Users lose unsaved work without notice.

## Goal

Show a countdown modal when the session is about to expire, giving the user the option to extend it or logout. Both the session timeout and the warning lead time must be configurable from the existing Parámetros Generales CRUD without touching code or restarting the server.

## Requirements

- Warning appears **3 minutes before expiry** (default, configurable)
- Session timeout is **30 minutes** (default, configurable)
- Warning timer resets only via **explicit "Extend session" button** — not by mouse/keyboard activity
- Configuration is stored in `parametros_sistema` and editable from the existing CRUD
- New timeout takes effect on the **next new session** (no restart required)
- Auto-logout when countdown reaches zero

---

## Section 1 — Database

New Liquibase migration `003-session-params.sql` inserts two rows into `parametros_sistema`:

| ID | `descripcion` | `tipo_dato_interfaz` | `valor_numerico` |
|----|---|---|---|
| 6 | `Tiempo de sesión (minutos)` | `number` | 30 |
| 7 | `Minutos de aviso antes de expirar sesión` | `number` | 3 |

Both rows appear automatically in the existing Parámetros Generales UI for editing.

---

## Section 2 — Backend

### 2a. Dynamic session timeout — `SessionTimeoutListener`

New `@Component` implementing `ApplicationListener<SessionCreatedEvent>`.

On every session creation:
1. Reads `parametros_sistema` ID 6 via `ParametrosSistemaRepository`
2. Calls `((HttpSession) event.getSession()).setMaxInactiveInterval(minutes * 60)`

This makes Spring Session use the DB-configured timeout for all new sessions. Existing sessions keep their original timeout (set at creation time). No server restart needed when the parameter changes.

### 2b. Keep-alive endpoint

```
GET /auth/keep-alive
```

- Requires valid session (protected by Spring Security)
- Returns `200 OK` with empty body
- Spring Session automatically resets `lastAccessedTime` on this request, extending the session

### 2c. Login response — session config fields

`LoginResponse` DTO gains two new fields:

```java
private int sessionTimeoutMinutes;  // from parametros_sistema id=6
private int warningMinutes;         // from parametros_sistema id=7
```

`UsuarioService.login()` reads both parameters from the DB and populates them in the response. The frontend receives them at login time — no extra API call needed.

---

## Section 3 — Frontend

### 3a. `SessionWarningService`

**Location:** `src/app/prestamil/core/services/session-warning.service.ts`

Responsibilities:
- Receives `sessionTimeoutMinutes` and `warningMinutes` from `AuthService.setSession()`
- Tracks `lastRequestTime: number` (epoch ms of last successful backend response)
- Runs `setInterval` every 10 seconds to check elapsed time
- When `(now - lastRequestTime) >= (sessionTimeoutMs - warningBeforeMs)`, emits warning state
- Exposes `warningState$: Observable<{ show: boolean; secondsRemaining: number }>`
- `recordActivity()` — updates `lastRequestTime` to now; called by interceptor
- `extendSession()` — calls `GET /auth/keep-alive`, then calls `recordActivity()`, hides modal
- `stop()` — clears interval and hides modal; called by `AuthService.logout()`

Internal countdown: once warning is shown, a second `setInterval` (1s) ticks down `secondsRemaining`. When it reaches 0, calls `authService.handleSessionInvalidation()`.

### 3b. `credentials.interceptor.ts` — updated

After forwarding each successful HTTP response, calls `sessionWarningService.recordActivity()`.

Excluded routes (no activity recording):
- `${apiUrl}/auth/login`
- `${apiUrl}/auth/logout`
- `${apiUrl}/auth/keep-alive` (to avoid a feedback loop)
- SSE stream URL (`${apiUrl}/auth/stream/logout`)

### 3c. `AuthService` — updated

`setSession(loginResponse)`:
- Reads `loginResponse.sessionTimeoutMinutes` and `loginResponse.warningMinutes`
- Calls `sessionWarningService.initialize(sessionTimeoutMinutes, warningMinutes)`

`logout()`:
- Calls `sessionWarningService.stop()` before clearing session

### 3d. `SessionWarningModalComponent`

**Location:** `src/app/prestamil/core/components/session-warning-modal/`

**Template:** Uses `NgbModal` (already in project). The modal is opened/closed programmatically by the component reacting to `warningState$`.

Content:
- Title: "Tu sesión está por expirar"
- Body: "La sesión se cerrará en **{M:SS}**. ¿Deseas continuar?"
- Primary button: **"Extender sesión"** → calls `sessionWarningService.extendSession()`
- Secondary button: **"Cerrar sesión"** → calls `authService.logout()`
- Modal is `backdrop: 'static'`, `keyboard: false` (cannot be dismissed accidentally)
- When `secondsRemaining <= 0`, modal closes and session is invalidated automatically

**Mounting point:** `admin.component.html` — added alongside the existing logout overlay.

`admin.component.ts` imports `SessionWarningModalComponent` and subscribes to `warningState$` to open/close the `NgbModal` instance.

---

## Data Flow

```
Login
  └─> AuthService.setSession()
        └─> SessionWarningService.initialize(30, 3)

Every HTTP response
  └─> credentials.interceptor → SessionWarningService.recordActivity()
        └─> lastRequestTime = Date.now()

Every 10s (setInterval)
  └─> SessionWarningService checks (now - lastRequestTime)
        ├─ < 27min → nothing
        └─ >= 27min → warningState$.next({ show: true, secondsRemaining: 180 })

Modal visible
  └─> 1s countdown tick
        ├─ "Extender sesión" → GET /auth/keep-alive → recordActivity() → hide modal
        ├─ "Cerrar sesión" → authService.logout()
        └─ secondsRemaining = 0 → authService.handleSessionInvalidation()

Logout
  └─> AuthService.logout() → SessionWarningService.stop()
```

---

## Constraints & Edge Cases

- **1 sesión por usuario:** El sistema ya fuerza sesión única, por lo que no hay riesgo de desincronización entre pestañas.
- **Keep-alive no modifica el timer del modal:** Si el usuario cierra el modal con "Extender", el `lastRequestTime` se actualiza y el countdown reinicia desde 27 min. El interceptor también actualiza `lastRequestTime` en cualquier otra petición.
- **SSE connection excluded from activity:** El stream SSE es una conexión persistente, no cuenta como actividad real del usuario.
- **Admin changes timeout value:** La nueva configuración aplica a sesiones futuras. Las sesiones activas mantienen el timeout con el que fueron creadas.
