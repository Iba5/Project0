# Digital Entertainment Voting Platform
# End-to-End System Architecture

## Overview

The Digital Entertainment Voting Platform is a secure, payment-driven competition management system.

Contestants publish their videos on external social media platforms while the platform manages:

- Competition events
- Contestants
- Secure voting
- Payment verification
- Administration
- Reporting
- Fraud detection
- Audit logging

The platform **does not host videos**.

Instead, it securely references content hosted on:

- TikTok
- Facebook
- Instagram
- YouTube

The backend is the **single source of truth**.

No frontend component communicates directly with:

- Database
- Supabase
- Paynow
- Storage
- External APIs

Everything passes through the backend.

---

# High-Level Architecture

```
                   Contestant
                        │
                  Upload Video
                        │
        TikTok / Facebook / Instagram / YouTube
                        │
                        ▼
                 Public Voting Website
                  (Next.js Frontend)
                        │
                        │ HTTPS + JWT
                        ▼
                 FastAPI Backend API
                        │
 ┌────────────────────────────────────────────┐
 │                                            │
 │ Authentication                             │
 │ Authorization                              │
 │ Events                                     │
 │ Contestants                                │
 │ Voting                                     │
 │ Payments                                   │
 │ Fraud Detection                            │
 │ Audit Logging                              │
 │ Reporting                                  │
 │ Media Verification                         │
 │ Settings                                   │
 │ Health Monitoring                          │
 └────────────────────────────────────────────┘
                        │
                        ▼
              SQLAlchemy Repositories
                        │
                        ▼
             Supabase PostgreSQL Database
                        │
                        ├───────────────► Supabase Storage
                        │
                        └───────────────► Future Background Jobs
```

---

# Core System Modules

## Authentication

Responsible for:

- Login
- Logout
- JWT generation
- Token validation
- Password reset
- Google OAuth (future)

---

## Authorization

Permission-based access control.

Roles:

- Super Admin
- Admin
- Moderator

Permissions:

- events.create
- events.update
- events.delete
- contestants.approve
- contestants.update
- payments.read
- reports.export
- settings.update

Roles are only permission groups.

The backend always validates permissions.

---

## Events

An Event is the root of the system.

Everything belongs to an Event.

Each event owns:

- Contestants
- Votes
- Payments
- Leaderboard
- Reports
- Rules

---

## Contestants

Each contestant contains:

- Personal profile
- Social media platform
- Video URL
- Approval status
- Vote totals

Videos are never uploaded to our servers.

Only references are stored.

---

## Voting

Votes are never directly created by users.

Votes are created ONLY after:

- Successful payment
- Verified callback
- Fraud checks
- Transaction commit

---

## Payments

Payments are handled exclusively through Paynow.

Frontend never communicates with Paynow directly.

Backend responsibilities:

- Create payment
- Verify payment
- Validate signature
- Handle callbacks
- Prevent duplicate processing

---

## Fraud Detection

Fraud detection executes before any vote is created.

Checks include:

- Duplicate callbacks
- Duplicate payment references
- Replay attacks
- Invalid signatures
- Closed events
- Disqualified contestants
- Suspicious voting behaviour

---

## Audit Logging

Every sensitive operation is permanently recorded.

Examples:

- Login
- Logout
- Failed login
- Payment created
- Payment verified
- Vote awarded
- Contestant approved
- Contestant rejected
- Event updated
- Settings changed

Audit records are immutable.

---

## Reporting

Generate:

- Revenue
- Votes
- Leaderboards
- Contestant performance
- Payment summaries

Reports are generated from stored data.

---

# Contestant Lifecycle

```
Draft
    ↓
Submitted
    ↓
Under Review
    ↓
Approved
    ↓
Visible
    ↓
Disqualified
    ↓
Archived
```

---

# Event Lifecycle

```
Draft
      ↓
Upcoming
      ↓
Registration Open
      ↓
Voting Open
      ↓
Voting Closed
      ↓
Completed
      ↓
Archived
```

---

# Payment Lifecycle

```
Created
      ↓
Pending
      ↓
Processing
      ↓
Paid
      ↓
Completed

OR

Failed

OR

Cancelled

OR

Expired

OR

Refunded
```

---

# End-to-End Contestant Flow

```
Contestant

↓

Registers

↓

Creates Profile

↓

Submits Video URL

↓

Status = Submitted

↓

Admin Review

↓

Approved

↓

Visible On Website

↓

Receives Votes
```

---

# End-to-End Voter Flow

```
Visitor

↓

Browse Active Event

↓

View Contestant

↓

Select Number of Votes

↓

Frontend Calls Backend

↓

Backend Creates Paynow Payment

↓

Frontend Redirects User

↓

User Pays

↓

Paynow Sends Webhook

↓

Backend Validates Signature

↓

Fraud Detection

↓

Idempotency Check

↓

Database Transaction

↓

Payment Recorded

↓

Vote Transaction Created

↓

Contestant Votes Updated

↓

Audit Log Written

↓

Commit

↓

Dashboard Updates
```

---

# End-to-End Admin Flow

```
Admin Login

↓

JWT Validation

↓

Permission Validation

↓

Dashboard

↓

Manage Events

↓

Approve Contestants

↓

Monitor Payments

↓

View Leaderboard

↓

Export Reports

↓

Manage Settings

↓

Audit Log Recorded
```

---

# Payment Processing Flow

```
Frontend

↓

POST /payments/create

↓

Payment Service

↓

Paynow

↓

Pending Payment

↓

Webhook

↓

Verify Signature

↓

Verify Payment Status

↓

Fraud Detection

↓

Idempotency Check

↓

Begin Transaction

↓

Create Payment Record

↓

Create Vote Transaction

↓

Increment Contestant Votes

↓

Create Audit Log

↓

Commit

↓

Return Success
```

---

# Request Processing Flow

Every request follows this order.

```
Client

↓

HTTPS

↓

Middleware

↓

Request ID

↓

Security Headers

↓

Rate Limiting

↓

JWT Authentication

↓

Permission Validation

↓

Request Validation

↓

Business Service

↓

Repository

↓

Database Transaction

↓

Audit Logging

↓

Response
```

---

# Database Responsibility

Database stores:

- Users
- Roles
- Permissions
- Events
- Contestants
- Payments
- Vote Transactions
- Audit Logs
- Reports
- Settings

Database NEVER contains business logic.

Business logic belongs inside Services.

---

# Repository Responsibility

Repositories:

- Read
- Write
- Update
- Delete

Nothing else.

Repositories never contain:

- Payment logic
- Fraud logic
- Authorization
- Business rules

---

# Service Responsibility

Services contain all business rules.

Examples:

AuthenticationService

PaymentService

VotingService

ContestantService

EventService

FraudService

AuditService

ReportService

Services may call multiple repositories.

---

# Security Pipeline

Every request must pass:

```
HTTPS

↓

Trusted Host Validation

↓

Rate Limiting

↓

Request Logging

↓

JWT Validation

↓

Permission Validation

↓

Input Validation

↓

Fraud Detection (where applicable)

↓

Business Rules

↓

Database Transaction

↓

Audit Log

↓

Response
```

---

# Security Principles

The backend must enforce:

- JWT Authentication
- Permission-based Authorization
- Argon2 Password Hashing
- SQLAlchemy ORM
- Parameterized Queries
- Atomic Transactions
- Idempotent Payment Processing
- Duplicate Callback Prevention
- Replay Attack Prevention
- Immutable Audit Logs
- Secure Environment Variables
- Centralized Exception Handling
- Centralized Logging
- HTTPS Only (Production)
- Security Headers
- Trusted Hosts
- Request IDs
- Health Monitoring

---

# Logging Policy

Always Log:

- Request ID
- User ID
- Endpoint
- Payment ID
- Duration
- Errors
- Security Events

Never Log:

- Passwords
- JWT Tokens
- Authorization Headers
- API Keys
- Integration Keys
- Secrets
- Environment Variables

---

# Future Background Jobs

Prepare architecture for:

- Social media verification
- Leaderboard cache refresh
- Email notifications
- SMS notifications
- Report generation
- Archive completed events
- Cleanup expired sessions
- Scheduled maintenance

---

# Definition of Success

The platform is complete when:

- Contestants can safely register.
- Admins can securely manage competitions.
- Users can purchase votes through Paynow.
- Votes are counted only after verified payment.
- Duplicate callbacks cannot create duplicate votes.
- Fraud detection protects financial operations.
- Every sensitive action is audited.
- Every endpoint is protected by authentication and authorization.
- Frontend communicates only with the backend.
- Backend is the single source of truth.
- The architecture is modular, scalable, secure, and maintainable.