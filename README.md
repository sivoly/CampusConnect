# CampusConnect: Secure Digital College Notice Board

CampusConnect is an enterprise-grade digital notice board application engineered for colleges and universities. It enforces strict server-side Role-Based Access Control (RBAC), robust security against OWASP Top 10 vulnerabilities, and a modern Glass UI design system.

---

## 🏛 System Architecture & Stack

- **Frontend**: Vanilla HTML5, CSS3 Glass UI Design System, Modern Vanilla JavaScript (zero framework lock-in).
- **Backend**: Python 3.12, FastAPI (Asynchronous ASGI, OpenAPI 3.0 docs).
- **Database & Migrations**: PostgreSQL 16 (dev/prod), SQLAlchemy 2.x ORM, Alembic migrations.
- **Authentication**: Server-side PostgreSQL sessions with SHA-256 hashed identifiers, HttpOnly + SameSite=Lax + Secure cookies, Argon2id password hashing (`argon2-cffi`).
- **CSRF Defense**: Cryptographic token matching on all state-changing endpoints (`POST`, `PUT`, `PATCH`, `DELETE`).
- **File Storage**: Isolated disk storage outside web root with magic-byte validation and randomized storage keys.
- **Rate Limiting**: `slowapi` on login and password reset endpoints.

---

## 📂 Project Directory Structure

```text
campusconnect/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (auth, content, dashboard, admin, attachments)
│   │   ├── core/            # Config (pydantic-settings), security (argon2), rate limiting
│   │   ├── models/          # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/         # Pydantic v2 schemas and validation envelopes
│   │   ├── services/        # Business logic & transaction boundaries
│   │   ├── auth/            # Dependencies, session validation, RBAC guards
│   │   ├── db/              # SQLAlchemy session factories and base models
│   │   ├── cli.py           # CLI admin bootstrap (`create-admin`)
│   │   └── main.py          # ASGI application entrypoint
│   ├── migrations/          # Alembic configuration & migration versions
│   └── tests/               # Pytest suite (Phase 1 to 10 automated test suites)
├── frontend/
│   ├── css/                 # Glass UI design system (tokens, components, layout)
│   ├── js/                  # Client-side API client, state, auth helpers
│   ├── pages/               # Semantic HTML pages (student, staff, admin views)
│   └── assets/              # Icons and logos
├── storage/
│   └── uploads/             # Isolated file storage (gitignored)
├── docs/
│   ├── ARCHITECTURE.md      # Security model, threat analysis & RBAC matrix
│   └── SCHEMA.md            # Normalized DB schema & entity relationship specs
├── docker-compose.yml       # PostgreSQL 16 & Mailpit development services
├── requirements.txt         # Production and development dependencies
├── .env.example             # Configuration template with placeholders
└── README.md
```

---

## 📋 11-Phase Implementation Roadmap

1. **Phase 1: Architecture, Folder Tree, Schema, Plan** *(Current)*
2. **Phase 2: Responsive UI Shell & Glass Design System**
3. **Phase 3: Database Models & Alembic Migrations**
4. **Phase 4: Authentication & Server-Side Sessions**
5. **Phase 5: Role-Based Access Control (RBAC)**
6. **Phase 6: Student Views & Real-Time Filtering**
7. **Phase 7: Staff Content Management & State Transitions**
8. **Phase 8: Admin User Management & Role Assignment**
9. **Phase 9: Secure File Handling & New Updates Engine**
10. **Phase 10: Full Test Run & Security Audit**
11. **Phase 11: Production Hardening & Final Documentation**
