# Supabase Database Tables - Usage Documentation

## Overview
This document explains which tables in your Supabase database are being used by the application, which ones are system/utility tables, and how they were created (via migrations vs manual changes).

---

## Total Tables: 15

---

## **Application Data Tables (12)**

### **Core Entity Tables**

| Model | Table | Purpose | Created Via | Status |
|-------|-------|---------|--------------|--------|
| `User` | `users` | Administrator accounts with RBAC | Migration (initial) | ✅ Active |
| `Competition` | `competitions` | Groups events, contestants, votes | Migration (initial) | ✅ Active |
| `Event` | `events` | Active/upcoming competitions | Migration (initial) | ✅ Active |
| `Participant` | `participants` | Contestants who receive votes | Migration (initial) | ✅ Active |

### **Payment & Voting Tables**

| Model | Table | Purpose | Created Via | Status |
|-------|-------|---------|--------------|--------|
| `Payment` | `payments` | Payment records (Paynow) | Migration (initial) | ✅ Active |
| `VoteTransaction` | `vote_transactions` | Audit records linking payments to contestants | Migration (initial) | ✅ Active |
| `PaymentMethodConfig` | `payment_method_configs` | Payment method configuration | Migration (add_payment_method_configs) | ✅ Active |
| `TestPayment` | `test_payments` | Development-only test payments | Migration (fe8d06520d01) | ⚠️ Dev Only |

### **Administration & Monitoring Tables**

| Model | Table | Purpose | Created Via | Status |
|-------|-------|---------|--------------|--------|
| `AuditLog` | `audit_logs` | Immutable security audit log | Migration (initial) | ✅ Active |
| `Activity` | `activities` | Dashboard activity items | Migration (initial) | ✅ Active |
| `Setting` | `settings` | Platform-wide global settings | Migration (initial) | ✅ Active |

### **External Integration Tables**

| Model | Table | Purpose | Created Via | Status |
|-------|-------|---------|--------------|--------|
| `SocialPlatformSync` | `social_platforms` | Social platform sync status | Migration (initial) | ✅ Active |

---

## **System/Utility Tables (3)**

| Table | Purpose | Created Via | Status |
|-------|---------|--------------|--------|
| `alembic_version` | Tracks migration history | Migration (initial) | ✅ Active |
| `rate_limit_buckets` | Rate limiting for API endpoints | Migration (b2c3d4e5f6a7) | ✅ Active |
| `revoked_tokens` | Revoked JWT tokens for security | Migration (b2c3d4e5f6a7) | ✅ Active |

---

## **Recent Manual Changes (Now Formalized)**

### **Issue Identified**
During the architectural improvements (Phase 1-4), several database schema changes were made **manually** to Supabase without corresponding Alembic migrations. This created a drift between the code models and the database schema.

### **Manual Changes Made**
1. **Events Table:**
   - Added `enable_videos` (boolean, NOT NULL, default false)
   - Added `share_link` (varchar, nullable)
   - Added `event_id` (varchar, nullable)

2. **Participants Table:**
   - Made `video_url` nullable (was NOT NULL)
   - Added `image_url` (varchar, nullable)
   - Added `bio` (text, nullable)
   - Added `event_id` (varchar, nullable)
   - Added foreign key `fk_participants_event_id` to events table

### **Resolution**
Created migration `add_event_lifecycle_and_participant_media_fields.py` to:
- ✅ Formalize all manual changes as proper migrations
- ✅ Make migration idempotent (skips changes that already exist)
- ✅ Ensure future deployments are reproducible
- ✅ Allow proper rollback capabilities

---

## **Migration History**

### **Current State**
```
Current Migration: add_event_lifecycle_fields
Previous Migration: 58c955045296 (merge_payment_configs_and_test_payments)
```

### **Migration Chain**
1. `d3e5a257eff5` - Initial tables
2. `a1b2c3d4e5f6` - Link payments/participants to events
3. `b1c2d3e4f5a6` - Add competitions voter tracking
4. `ad71a2c892e3` - Add user token columns
5. `b2c3d4e5f6a7` - Add revoked tokens and rate limits
6. `068af20d4b64` - Add Paynow poll URL and reference fields
7. `734b5e91ee76` - Add missing user lockout columns
8. `add_idempotency_key_to_payments` - Add idempotency key
9. `add_payment_method_configs` - Add payment method configs
10. `add_refresh_token_fields` - Add refresh token fields
11. `fe8d06520d01` - Add test payments table (dev only)
12. `fe97a81f83b0` - Merge lockout and idempotency migrations
13. `eef6e0be5718` - Merge multiple heads
14. `58c955045296` - Merge payment configs and test payments
15. `add_event_lifecycle_fields` - **NEW** Event lifecycle and participant media fields

---

## **Table Utilization Summary**

### **✅ Fully Utilized (12 tables)**
All application data tables are actively used by the backend code:

- **Users**: Admin authentication, RBAC, invitations
- **Competitions**: Event grouping, configuration
- **Events**: Competition lifecycle, registration, voting
- **Participants**: Contestant management, voting
- **Payments**: Paynow integration, payment tracking
- **VoteTransactions**: Audit trail for votes
- **PaymentMethodConfigs**: Payment method management
- **AuditLogs**: Security audit trail
- **Activities**: Dashboard overview
- **Settings**: Platform configuration
- **SocialPlatforms**: Social media integration
- **TestPayments**: Development testing (to be removed in production)

### **✅ System Tables (3 tables)**
All system tables are actively used:

- **Alembic Version**: Migration tracking
- **Rate Limit Buckets**: API rate limiting
- **Revoked Tokens**: JWT token security

---

## **Production Deployment Checklist**

### **Before Production:**
- [ ] Ensure `TEST_PAYMENT_MODE=false` in `.env`
- [ ] Verify all migrations are applied
- [ ] Remove or disable `test_payments` table
- [ ] Verify manual changes are formalized in migrations
- [ ] Test rollback procedure
- [ ] Backup database

### **Post-Deployment:**
- [ ] Verify `alembic_version` table has correct migration
- [ ] Check all foreign key constraints are working
- [ ] Verify all indexes are created
- [ ] Test application functionality
- [ ] Monitor for migration errors

---

## **Notes**

- **No unused tables**: All 15 tables are actively used by the application
- **No duplicate tables**: Each table has a unique purpose
- **Naming convention**: Consistent lowercase with underscores
- **Migration compliance**: All changes now tracked via Alembic
- **Reproducible deployments**: Manual changes have been formalized
- **Safe rollback**: Migration includes proper downgrade logic

---

## **Model-Table Mapping Verification**

```python
# All models in app/models/models.py have corresponding tables:

User                   -> users                     ✓
Competition            -> competitions              ✓
Event                  -> events                    ✓
Participant            -> participants              ✓
Payment                -> payments                  ✓
VoteTransaction        -> vote_transactions         ✓
AuditLog               -> audit_logs                ✓
PaymentMethodConfig    -> payment_method_configs    ✓
Activity               -> activities                ✓
SocialPlatformSync     -> social_platforms          ✓
Setting                -> settings                  ✓
TestPayment            -> test_payments             ✓
```

---

## **Conclusion**

All 15 tables in your Supabase database are:
- ✅ Being utilized by the application
- ✅ Created via proper migrations (including recently formalized manual changes)
- ✅ Following consistent naming conventions
- ✅ Tracked in Alembic migration history
- ✅ Ready for production deployment

The manual schema changes made during architectural improvements have now been formalized into a proper migration (`add_event_lifecycle_fields`), ensuring future deployments are reproducible and all changes are tracked.
