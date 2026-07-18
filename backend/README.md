# Digital Entertainment Voting Platform Backend

This is the production-ready FastAPI backend scaffold for the Digital Entertainment Voting Platform. It acts as the single source of truth for vote storage, admin customization, and Paynow transaction reconciliations.

## Technical Specifications
- **Python:** 3.12+
- **Framework:** FastAPI
- **Database ORM:** SQLAlchemy 2.0 (configured with pooling for Supabase PostgreSQL)
- **Migrations:** Alembic
- **Validation:** Pydantic v2 (configured with automatic camelCase alias generator)
- **Security:** Argon2-cffi password hashing & JWT token validation

---

## Folder Architecture
```text
backend/
├── app/
│   ├── api/             # API Endpoints (v1 versioned)
│   ├── core/            # Database Session, Config Settings, JWT Security
│   ├── models/          # SQLAlchemy Database Models
│   ├── schemas/         # Pydantic Schemas (CamelCase conversion)
│   ├── repositories/    # Database Repository Pattern queries
│   ├── services/        # Service layer containing Core Business Rules
│   └── utils/           # Helper scripts (Paynow integrations, logging helpers)
├── migrations/          # Alembic Migration Scripts
├── tests/               # Automated test configurations (pytest)
├── main.py              # Dev server entrypoint
└── requirements.txt     # Python Dependencies
```

---

## Local Setup

1. **Virtual Environment Setup:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configuration Settings:**
   Copy the example file to configure your local credentials:
   ```bash
   cp .env.example .env
   ```

3. **Running Database Migrations:**
   ```bash
   alembic upgrade head
   ```

4. **Running Dev Server:**
   ```bash
   python main.py
   ```
   Navigate to `http://localhost:8000/api/v1/docs` to access interactive Swagger documentation.

5. **Running Test Suite:**
   ```bash
   pytest
   ```
