# Project: Digital Entertainment Voting Platform Backend

## Overview

Build a production-ready backend for a Digital Entertainment Voting Platform.

Contestants upload videos to external platforms:
- TikTok
- Facebook
- Instagram
- YouTube

Users visit our website, select contestants, purchase votes using Paynow, and votes are only counted after successful payment verification.

This backend is the single source of truth.

The frontend never communicates directly with the database or external services.

---

# Technology Stack

Backend
- Python 3.12
- FastAPI
- SQLAlchemy 2.x
- Alembic

Database
- Supabase PostgreSQL

Storage
- Supabase Storage

Authentication
- JWT
- Google OAuth (later)

Payments
- Paynow Zimbabwe

Validation
- Pydantic v2

---

# Architecture

Frontend

↓

Next.js

↓

FastAPI

↓

Services

↓

Repositories

↓

SQLAlchemy

↓

Supabase PostgreSQL

No frontend component should communicate directly with Supabase.

---

# Security Rules

These rules are mandatory.

## Authentication

- JWT Authentication.
- Passwords must be hashed using Argon2.
- Never store plain passwords.
- JWT secret must never be hardcoded.
- All secrets must come from environment variables.
- Access tokens should expire.
- Refresh token support should be designed for future implementation.

---

## Authorization

Implement Role-Based Access Control.

Roles

- Super Admin
- Admin
- Moderator

Every protected endpoint must verify:

- Valid JWT
- Active user
- Correct role

Never trust role information coming from the frontend.

---

## Database Security

- Use SQLAlchemy ORM.
- Use transactions for all financial operations.
- Never concatenate SQL strings.
- Prevent duplicate payment processing.
- Every payment reference must be unique.
- Every database write must be atomic.
- Roll back transactions on failure.

---

## API Security

- Validate all incoming payloads.
- Never trust frontend values.
- Return generic authentication errors.
- Do not expose stack traces.
- Use centralized exception handlers.
- Validate UUIDs.
- Validate enums.
- Validate dates.

---

## Logging

Log

- Login
- Logout
- Failed logins
- Admin actions
- Payment callbacks
- Exceptions

Never log

- Passwords
- JWTs
- Integration keys
- Secrets

---

## Payments

Votes are awarded ONLY after Paynow confirms payment.

Payment Flow

User

↓

Create Payment

↓

Redirect to Paynow

↓

Paynow Callback

↓

Verify Signature

↓

Verify Payment

↓

Database Transaction

↓

Create Payment Record

↓

Increment Votes

↓

Commit Transaction

Payment processing must be idempotent.

Receiving the same callback multiple times must never increase votes twice.

---

# Folder Structure

backend/

app/

api/
v1/

core/
config.py
database.py
security.py

models/

schemas/

repositories/

services/

utils/

main.py

migrations/

tests/

.env.example

requirements.txt

README.md

---

# Layers

## Models

SQLAlchemy ORM models.

No business logic.

---

## Schemas

Pydantic request/response models.

Validation only.

---

## Repositories

Database access only.

Repositories never contain business rules.

---

## Services

Business logic.

Examples

- Authentication
- Payments
- Voting
- Events
- Contestants

Services may call multiple repositories.

---

## API

Thin controllers.

Responsibilities

- Validate request
- Call service
- Return response

No business logic.

---

# Initial Modules

Authentication

- Login
- Register Admin
- Forgot Password
- Google OAuth placeholder
- Refresh Token placeholder

Dashboard

- Statistics
- Revenue
- Votes
- Activity

Events

- CRUD

Contestants

- CRUD
- Approval
- Status

Payments

- Payment initiation
- Payment verification
- Payment history

Votes

- Vote recording
- Leaderboard

Settings

- Platform settings

---

# Coding Standards

- Use type hints everywhere.
- Every public function must include a docstring.
- Keep functions focused.
- Use dependency injection.
- Avoid duplicated code.
- Keep services independent.
- Use async where appropriate.
- Use meaningful names.

---

# Error Handling

Create centralized exception handlers.

Return consistent JSON:

{
    "success": false,
    "message": "...",
    "errors": []
}

Never expose internal exceptions to clients.

---

# Documentation

Every endpoint must include:

- Summary
- Description
- Request model
- Response model
- Status codes

FastAPI OpenAPI documentation should be fully generated.

---

# Goal

Generate only the project scaffold.

Do not implement complete business logic.

Create placeholders with clear TODOs, docstrings, and comments describing responsibilities.

The scaffold should be clean, modular, secure, and ready for incremental development.