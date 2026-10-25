# CampusConnect Architecture Specification

## 1. System Overview

CampusConnect is a secure digital college notice board system designed for high availability, enterprise-grade access control, and stringent security standards.

```mermaid
graph TD
    Client["Client (Browser) - HTML5 / Vanilla JS / Glass UI"]
    FastAPI["FastAPI Application (ASGI / Python 3.12)"]
    Postgres[("PostgreSQL Database (SQLAlchemy 2.x / Alembic)")]
    DiskStorage[("Encrypted / Isolated File Storage (/storage/uploads)")]
    SessionStore["Server-Side Session Store (PostgreSQL sessions)"]

    Client -->|HTTPS + HttpOnly Cookie + CSRF Header| FastAPI
    FastAPI -->|ORM / Parameterized Queries| Postgres
    FastAPI -->|Session Validation on Every Request| SessionStore
    FastAPI -->|Randomized Storage Keys & Stream Auth| DiskStorage
```

---

## 2. Security Architecture & Threat Model

### 2.1 Authentication & Session Management
- **Passwords**: Hashed with **Argon2id** (`argon2-cffi`) using parameters `time_cost=2`, `memory_cost=65536` (64 MiB), `parallelism=2`.
- **Session Tokens**:
  - The client receives a high-entropy random token (`secrets.token_urlsafe(32)`) inside a cookie: `HttpOnly`, `SameSite=Lax`, and `Secure` (in HTTPS/production).
  - The database stores only the `SHA-256` hash of the session token.
  - Every incoming request queries the active user and session status from the database.
  - Deactivating a user or resetting their password invalidates all active sessions immediately.
- **CSRF Defense**:
  - State-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid `X-CSRF-Token` header matching the active session's CSRF token.
  - Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt.
- **Rate Limiting**:
  - Configured via `slowapi` on `/api/auth/login` (5/min) and `/api/auth/forgot-password` (3/min).
  - Prevents credential stuffing and token enumeration.
- **Account Enumeration Defense**:
  - Password reset always returns identical success responses regardless of whether the submitted email address exists.

### 2.2 Security Headers & Output Encoding
- **Security Headers**:
  - `Content-Security-Policy`: Default restricts scripts and frames to self; disallows inline scripts.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Cache-Control: no-store, no-cache, must-revalidate` on all authenticated endpoints.
- **Output Encoding (XSS Prevention)**:
  - Frontend code exclusively utilizes DOM properties like `textContent` and `createElement` for user-supplied data, strictly avoiding `innerHTML`.

### 2.3 File Upload & Serving Security
- **Isolation**: Uploaded files are stored in `storage/uploads/` outside the web root.
- **Random Storage Keys**: Filenames on disk are UUIDv4 / SHA-256 hashes without original extensions.
- **Magic Bytes Validation**: Content type is verified using file magic bytes (`filetype` library), not trusting client-provided MIME headers.
- **Access Control**: Served exclusively via authenticated streaming endpoint `GET /api/attachments/{id}`, verifying published visibility before streaming.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Permission / Action | Student | Staff | Admin |
| :--- | :---: | :---: | :---: |
| View Published & Currently Visible Content | ✅ | ✅ | ✅ |
| View Drafts & Unpublished Content | ❌ | ✅ | ✅ |
| Create & Edit Notices, Events, Hall Allocations | ❌ | ✅ | ✅ |
| Publish / Unpublish Content | ❌ | ✅ | ✅ |
| Upload & Delete Attachments | ❌ | ✅ | ✅ |
| View User Directory | ❌ | ❌ | ✅ |
| Create User Accounts | ❌ | ❌ | ✅ |
| Update User Role / Status | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ❌ | ✅ |
| Modify System Settings | ❌ | ❌ | ✅ |

### Invariant Security Rules:
1. **Self-Demotion / Deactivation Prevention**: An admin cannot deactivate or demote their own account.
2. **Last Active Admin Protection**: The database and API reject any operation that leaves zero active administrators.
3. **No Self-Registration**: Only administrators can create accounts; initial bootstrap via CLI `python -m backend.app.cli create-admin`.

---

## 4. Glass UI Design System

- **Palette**:
  - Background: `#F8FAFC` to `#FFFFFF` with glass layering
  - Header & Card Glass: `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(12px)`
  - Primary Brand Navy: `#163A63`
  - Accent Energy Orange: `#FF8A00`
  - Border Glass: `rgba(229, 231, 235, 0.8)`
  - Divider: `#E5E7EB`
  - Text: Primary `#1E293B`, Secondary `#475569`, Inverted `#FFFFFF`
- **Typography**: Inter (Google Fonts) with semantic scale from 12px to 32px.
- **Responsive Layout**: Desktop collapsible sidebar, tablet optimized view, mobile fixed bottom bar / touch drawer.

---

## 5. Security Advisory & Architecture Clarification

> [!WARNING]
> **API Key Advisory**: The string `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` provided in the prompt is an **OpenAI Project API Key**, NOT a Firebase credential.
>
> 1. Because secret keys must never be exposed or committed, please **revoke and rotate this OpenAI key immediately** in the OpenAI dashboard.
> 2. The project specification calls for **PostgreSQL + SQLAlchemy 2.x + Alembic** for reliable relational integrity, ACID transactions, and session storage. We adhere to this database architecture, with an isolated adapter layer should Firestore or Firebase Auth be desired later.
