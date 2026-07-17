# Voting Admin App - System Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                                       │
│                         (Next.js Frontend)                                   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTPS
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                           NEXT.JS FRONTEND                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Presentation Layer                                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │ Dashboard│ │  Events  │ │Participants│ │ Payments │ │ Settings │    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                          │  │
│  │  │  Login   │ │  Signup  │ │ Forgot   │                          │  │
│  │  └──────────┘ └──────────┘ │ Password │                          │  │
│  │                           └──────────┘                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐  │
│  │  State Management & API Layer                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ React Query (TanStack Query) - Server State                      │ │  │
│  │  │ Axios - HTTP Client with JWT Interceptor                         │ │  │
│  │  │ Cookie-based Auth Storage                                         │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP/JSON
                                     │ JWT Auth
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                        FASTAPI BACKEND                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │  CORS    │ │  GZip    │ │Rate Limit│ │Security  │ │ Request  │    │  │
│  │  │          │ │          │ │          │ │ Headers  │ │ Logging  │    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐  │
│  │  API Layer (Thin Controllers)                                          │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ /api/v1/auth       - Login, Register, Logout, Forgot Password    │ │  │
│  │  │ /api/v1/dashboard  - Statistics, Revenue, Votes, Activity         │ │  │
│  │  │ /api/v1/events     - CRUD Operations for Events                   │ │  │
│  │  │ /api/v1/participants - CRUD Operations for Contestants            │ │  │
│  │  │ /api/v1/payments   - Payment Initiation, Callback, History        │ │  │
│  │  │ /api/v1/settings   - Platform Settings                            │ │  │
│  │  │ /api/v1/social-router - Social Platform Sync Status               │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐  │
│  │  Business Logic Layer (Services)                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ AuthService       - Authentication, JWT, Password Reset         │ │  │
│  │  │ PaymentService    - Paynow Integration, Vote Allocation           │ │  │
│  │  │ DashboardService   - Statistics, Aggregation                      │ │  │
│  │  │ EventService       - Event Lifecycle Management                    │ │  │
│  │  │ ParticipantService - Contestant Management                        │ │  │
│  │  │ FraudDetectionService - Duplicate Payment Prevention              │ │  │
│  │  │ IdempotencyService  - Idempotent Payment Processing               │ │  │
│  │  │ AuditService       - Security Logging                             │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐  │
│  │  Data Access Layer (Repositories)                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │ BaseRepository      - Generic CRUD with Soft Delete             │ │  │
│  │  │ UserRepository      - User Data Access                          │ │  │
│  │  │ EventRepository     - Event Data Access                          │ │  │
│  │  │ ParticipantRepository - Contestant Data Access                   │ │  │
│  │  │ PaymentRepository   - Payment Data Access                        │ │  │
│  │  │ VoteTransactionRepository - Vote Audit Records                    │ │  │
│  │  │ ActivityRepository  - Dashboard Activity Data                    │ │  │
│  │  │ SocialPlatformRepository - Social Platform Status                 │ │  │
│  │  │ SettingsRepository  - Platform Settings                           │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ SQLAlchemy ORM
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                        SUPABASE POSTGRESQL                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Database Tables                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │  users   │ │  events  │ │participants│ │ payments │ │ vote_    │    │  │
│  │  │          │ │          │ │           │ │          │ │transactions│ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                          │  │
│  │  │audit_logs│ │activities│ │social_    │                          │  │
│  │  │          │ │          │ │platforms  │                          │  │
│  │  └──────────┘ └──────────┘ └──────────┘                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Paynow Zimbabwe - Payment Processing                                 │  │
│  │  (Payment Initiation → User Payment → Callback → Vote Allocation)     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 16.2.10 (App Router)
- **Language**: TypeScript 5
- **UI Library**: React 19.2.4
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (Radix UI primitives)
- **State Management**: TanStack React Query 5.101.2
- **HTTP Client**: Axios 1.18.1
- **Form Handling**: React Hook Form 7.81.0
- **Validation**: Zod 4.4.3
- **Theming**: next-themes 0.4.6
- **Notifications**: Sonner 2.0.7

### Backend
- **Framework**: FastAPI 0.110.0+
- **Language**: Python 3.12
- **Server**: Uvicorn 0.28.0+
- **ORM**: SQLAlchemy 2.0.0+
- **Database**: Supabase PostgreSQL (psycopg2-binary 2.9.9+)
- **Validation**: Pydantic v2 (2.6.0+)
- **Authentication**: python-jose[cryptography] 3.3.0+
- **Password Hashing**: Argon2 (argon2-cffi 23.1.0+)
- **Migrations**: Alembic 1.13.0+
- **HTTP Client**: httpx 0.27.0+
- **Configuration**: pydantic-settings 2.2.1+
- **Environment**: python-dotenv 1.0.1+

## Data Flow

### Authentication Flow
```
1. User → Login Page (Next.js)
2. Frontend → POST /api/v1/auth/login (with credentials)
3. Backend → AuthService validates credentials
4. Backend → JWT token generated
5. Backend → Return token + user data
6. Frontend → Store token in cookies
7. Frontend → Attach token to all subsequent requests via Axios interceptor
8. Backend → Verify JWT on protected routes
```

### Payment Flow
```
1. User → Select contestant → Purchase votes
2. Frontend → POST /api/v1/payments/initiate
3. Backend → PaymentService creates pending payment record
4. Backend → PaynowClient initiates Paynow transaction
5. Backend → Return Paynow checkout URL
6. User → Redirected to Paynow → Complete payment
7. Paynow → POST /api/v1/payments/paynow/callback
8. Backend → Verify signature, check payment status
9. Backend → Process payment atomically (transaction)
10. Backend → Create vote transaction record
11. Backend → Increment contestant votes
12. Backend → Commit transaction
13. Frontend → Poll payment status / receive webhook
```

### Event Management Flow
```
1. Admin → Dashboard → Events Page
2. Frontend → GET /api/v1/events (list events)
3. Backend → EventService → EventRepository → Database
4. Admin → Create/Edit Event
5. Frontend → POST/PUT /api/v1/events
6. Backend → EventService validates business logic
7. Backend → EventRepository updates database
8. Frontend → Refresh event list
```

## Security Architecture

### Authentication
- JWT tokens with expiration (8 days default)
- Argon2 password hashing
- Cookie-based token storage (HttpOnly, SameSite=Lax)
- Protected routes require valid JWT
- Role-based access control (Super Admin, Admin, Moderator)

### Authorization
- Permission-based access control
- Dependency injection for permission checking
- Role verification from database (not frontend)
- Audit logging for all admin actions

### API Security
- CORS configuration
- Rate limiting middleware
- Request logging middleware
- Security headers middleware
- Input validation via Pydantic
- SQL injection prevention via SQLAlchemy ORM
- Generic error messages (no stack traces)

### Payment Security
- Idempotent payment processing
- Signature verification for Paynow callbacks
- Atomic database transactions
- Unique payment references
- Fraud detection service
- Vote allocation only after payment confirmation

## Database Schema

### Core Models
- **User**: Admin accounts with RBAC
- **Event**: Competition events with lifecycle management
- **Participant**: Contestants with video URLs and vote counts
- **Payment**: Payment records with Paynow integration
- **VoteTransaction**: Audit records linking payments to votes
- **AuditLog**: Immutable security audit trail
- **Activity**: Dashboard activity feed
- **SocialPlatform**: Social media sync status
- **Setting**: Platform-wide configuration

### Key Relationships
- User → AuditLog (one-to-many)
- Event → Participants (one-to-many)
- Participant → Payments (one-to-many)
- Participant → VoteTransactions (one-to-many)
- Payment → VoteTransaction (one-to-one)

## Deployment Architecture

### Development
- Frontend: `npm run dev` (Next.js dev server)
- Backend: `python main.py` (Uvicorn with auto-reload)
- Database: Supabase PostgreSQL (cloud)
- Environment: Local .env files

### Production (Recommended)
- Frontend: Vercel/Netlify (Next.js optimized)
- Backend: Docker container with Uvicorn Gunicorn
- Database: Supabase PostgreSQL (production)
- Load Balancer: Nginx/Cloudflare
- SSL: HTTPS redirect middleware
- Monitoring: Health check endpoint at /health

## Key Design Patterns

### Backend
- **Repository Pattern**: Separation of data access logic
- **Service Layer**: Business logic encapsulation
- **Dependency Injection**: FastAPI Depends()
- **Middleware Pipeline**: Request processing chain
- **Exception Handling**: Centralized error handlers
- **Soft Delete**: Data preservation with deleted_at timestamps

### Frontend
- **Component Composition**: Reusable UI components
- **Custom Hooks**: Encapsulated logic
- **Provider Pattern**: React Query, Theme providers
- **API Client Pattern**: Centralized Axios configuration
- **Error Boundary**: Graceful error handling

## File Structure

### Backend
```
backend/
├── main.py                    # Application entry point
├── app/
│   ├── main.py              # FastAPI app factory
│   ├── api/v1/              # API endpoints
│   │   ├── endpoints/       # Route handlers
│   │   ├── api.py          # Router aggregation
│   │   └── dependencies.py # Dependency injection
│   ├── core/               # Core configuration
│   │   ├── config.py       # Settings management
│   │   ├── database.py     # Database session
│   │   └── security.py     # JWT & password hashing
│   ├── models/             # SQLAlchemy models
│   ├── schemas/            # Pydantic schemas
│   ├── repositories/       # Data access layer
│   ├── services/           # Business logic layer
│   ├── middleware/         # Custom middleware
│   ├── exceptions/         # Custom exceptions
│   ├── enums/              # Enum definitions
│   ├── audit/              # Audit logging
│   ├── integrations/       # External service clients
│   └── utils/              # Utility functions
├── migrations/             # Alembic migrations
└── requirements.txt         # Python dependencies
```

### Frontend
```
frontend/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard pages
│   ├── events/            # Event management pages
│   ├── participants/      # Contestant pages
│   ├── payments/          # Payment pages
│   ├── settings/         # Settings pages
│   ├── login/             # Authentication pages
│   ├── api/               # API routes (if needed)
│   ├── layout.tsx         # Root layout
│   └── providers.tsx      # Global providers
├── components/
│   ├── pages/             # Page components
│   ├── ui/                # shadcn/ui components
│   └── app-shell.tsx      # App layout wrapper
├── lib/                   # Utility libraries
│   ├── api.ts            # Axios configuration
│   ├── auth.ts           # Auth utilities
│   └── types.ts          # TypeScript types
└── package.json          # Node dependencies
```

## Monitoring & Observability

### Health Checks
- Endpoint: `/health`
- Checks: API status, Database connectivity, Storage status
- Returns: Uptime, version, component status

### Logging
- Request logging middleware
- Audit trail for admin actions
- Payment callback logging
- Exception logging with stack traces (server-side only)

### Error Handling
- Centralized exception handlers
- Generic error messages to clients
- Detailed logging for debugging
- Validation error formatting

## Performance Considerations

### Database
- Connection pooling via SQLAlchemy
- Pool pre-ping for connection health
- Indexed fields (email, payment reference)
- Soft delete filtering optimization

### API
- GZip compression middleware
- Rate limiting to prevent abuse
- Async operations where appropriate
- Efficient query design

### Frontend
- React Query caching (60s stale time)
- Code splitting via Next.js
- Optimistic updates for better UX
- Skeleton loaders for perceived performance

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- JWT authentication (no server-side session)
- Database connection pooling
- External payment processing

### Vertical Scaling
- Efficient database queries
- Minimal memory footprint
- Lazy loading where appropriate
- Background task processing (future)

This architecture provides a solid foundation for a secure, scalable voting administration platform with clear separation of concerns and modern development practices.