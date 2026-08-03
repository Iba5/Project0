# Test Payment System - Cleanup Instructions

## Overview
The test payment system allows you to test payment flows without using real money during development. This document explains how to clean up and remove the test payment system before production deployment.

## Current Configuration
- **Test Mode**: Currently enabled (`TEST_PAYMENT_MODE=true` in `.env`)
- **Test Payment Table**: `test_payments` table created in database
- **Test Payment Endpoints**: Available for development testing

## Pre-Production Cleanup Steps

### 1. Disable Test Payment Mode
Update your `.env` file to disable test payments:
```bash
# Set to false for production
TEST_PAYMENT_MODE=false
```

### 2. Clean Up Test Payment Data
Before dropping the table, you may want to export test payment data for reference:
```bash
# Export test payment data (optional)
SELECT * FROM test_payments;
```

### 3. Clean Up Test Payments via API
Use the cleanup endpoint to delete all test payments:
```bash
DELETE /api/v1/payments/test/cleanup
```

### 4. Run Database Migration to Drop Test Payment Table
Create a new migration to drop the test_payments table:
```bash
cd backend
source .venv/bin/activate
alembic revision -m "remove_test_payments_table_for_production"
```

Edit the generated migration file to drop the table:
```python
def upgrade() -> None:
    """Drop test_payments table for production"""
    op.drop_table('test_payments')

def downgrade() -> None:
    """Recreate test_payments table for development"""
    # Reverse the upgrade steps
    op.create_table(
        'test_payments',
        # ... (copy from fe8d06520d01 migration)
    )
```

### 5. Remove Test Payment Code from Application

#### Backend Changes
1. **Remove TestPayment model** from `/backend/app/models/models.py`:
   - Remove the `TestPayment` class (lines 288-313)

2. **Remove TestPayment repository** from `/backend/app/repositories/repositories.py`:
   - Remove `TestPayment` from imports
   - Remove `TestPaymentRepository` class (lines 380-427)

3. **Remove test payment logic** from `/backend/app/services/services.py`:
   - Remove `TestPayment` from imports
   - Remove `TestPaymentRepository` from imports
   - Remove `test_payment_repo` from `PaymentService.__init__`
   - Remove `test_mode` from `PaymentService.__init__`
   - Remove `_initiate_test_payment` method
   - Remove test mode check from `initiate_payment` method

4. **Remove test payment endpoints** from `/backend/app/api/v1/endpoints/payments.py`:
   - Remove `TestPayment` from imports
   - Remove all test payment endpoints (lines 179-380)

5. **Remove test payment configuration** from `/backend/app/core/config.py`:
   - Remove `TEST_PAYMENT_MODE` configuration (lines 51-54)

#### Frontend Changes
1. Remove any test payment UI components (if added)
2. Remove test payment API calls (if added)

### 6. Update Environment Variables
Remove test payment configuration from `.env`:
```bash
# Remove this line
TEST_PAYMENT_MODE=true
```

### 7. Test Production Configuration
Verify that payments now use real Paynow integration:
```bash
# Test payment initiation with TEST_PAYMENT_MODE=false
# Should now call Paynow SDK instead of creating test payments
```

## Migration Cleanup Command

When ready to remove test payments from production, run:
```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

## Verification Steps

1. **Verify test payment table is dropped**:
   ```sql
   SELECT * FROM test_payments;  -- Should fail: table does not exist
   ```

2. **Verify test payment endpoints are removed**:
   ```bash
   GET /api/v1/payments/test/list  -- Should return 404
   POST /api/v1/payments/test/{reference}/complete  -- Should return 404
   DELETE /api/v1/payments/test/cleanup  -- Should return 404
   ```

3. **Verify real payments work**:
   - Test a real payment with Paynow
   - Verify payment record is created in `payments` table
   - Verify vote transaction is created

## Emergency Rollback

If you need to restore test payment functionality:
1. Revert the removal migration:
   ```bash
   alembic downgrade <migration-id>
   ```
2. Restore the code changes from version control
3. Re-enable `TEST_PAYMENT_MODE=true` in `.env`

## Important Notes

- **Never run test payments in production** - this could create confusion and security issues
- **Always backup your database** before dropping tables
- **Test payment cleanup in staging** before production
- **Remove test payment code completely** to avoid security risks
- **Audit logs** will still show test payment activity even after cleanup

## Production Checklist

- [ ] `TEST_PAYMENT_MODE=false` in `.env`
- [ ] Test payment data cleaned up
- [ ] Test payment table dropped via migration
- [ ] Test payment code removed from backend
- [ ] Test payment endpoints removed
- [ ] Test payment configuration removed
- [ ] Real Paynow integration tested
- [ ] Database migration tested in staging
- [ ] No test payment references in codebase
- [ ] Environment variables cleaned up

## Contact

If you encounter issues during cleanup, check:
1. Database migration logs
2. Application logs for test payment references
3. Git history for removed code
4. Backup files for data recovery