-- Supabase Migration Script: Remove Competition Model and Simplify Participant Status
-- This script should be run directly on Supabase SQL Editor
-- Execute each section separately to see results

-- ============================================================================
-- STEP 1: Update contestant_status enum to only have approved and disqualified
-- ============================================================================

-- First, convert the status column to text temporarily
ALTER TABLE participants ALTER COLUMN status TYPE VARCHAR(50);

-- Drop the old enum
DROP TYPE IF EXISTS contestant_status CASCADE;

-- Create new enum with only approved and disqualified
CREATE TYPE contestant_status AS ENUM ('approved', 'disqualified');

-- Convert back to enum, defaulting to approved for existing records
UPDATE participants SET status = 'approved' WHERE status IS NULL OR status = '' OR status NOT IN ('approved', 'disqualified');
ALTER TABLE participants ALTER COLUMN status TYPE contestant_status USING status::contestant_status;

-- ============================================================================
-- STEP 2: Remove competition_id columns
-- ============================================================================

-- Drop competition_id from participants table (if exists)
ALTER TABLE participants DROP COLUMN IF EXISTS competition_id;

-- Drop competition_id from payments table (if exists)  
ALTER TABLE payments DROP COLUMN IF EXISTS competition_id;

-- Drop competition_id from vote_transactions table (if exists)
ALTER TABLE vote_transactions DROP COLUMN IF EXISTS competition_id;

-- Add event_id to vote_transactions table (if not exists)
ALTER TABLE vote_transactions ADD COLUMN IF NOT EXISTS event_id VARCHAR REFERENCES events(id) ON DELETE SET NULL;

-- Drop competition_id from test_payments table (if exists)
ALTER TABLE test_payments DROP COLUMN IF EXISTS competition_id;

-- Add event_id to test_payments table (if not exists)
ALTER TABLE test_payments ADD COLUMN IF NOT EXISTS event_id VARCHAR REFERENCES events(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 3: Drop competitions table
-- ============================================================================

DROP TABLE IF EXISTS competitions CASCADE;

-- ============================================================================
-- STEP 4: Drop competition_status enum
-- ============================================================================

DROP TYPE IF EXISTS competition_status CASCADE;

-- ============================================================================
-- STEP 5: Update event_id column (make it required in practice)
-- ============================================================================

-- Note: We keep event_id nullable in the database for migration safety
-- but the application enforces it as required during participant creation
-- If you want to make it truly NOT NULL in the database, run:
-- ALTER TABLE participants ALTER COLUMN event_id SET NOT NULL;
-- ALTER TABLE participants ALTER COLUMN event_id DROP DEFAULT;

-- ============================================================================
-- STEP 6: Verification queries (run these to verify changes)
-- ============================================================================

-- Check contestant_status enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contestant_status')
ORDER BY enumsortorder;

-- Check that competitions table is gone
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'competitions';

-- Check that competition_status enum is gone
SELECT typname FROM pg_type WHERE typname = 'competition_status';

-- Check participants table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'participants' 
ORDER BY ordinal_position;

-- Check payments table structure  
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' 
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 7: Rollback script (save this if you need to revert)
-- ============================================================================

/*
-- To rollback, run this SQL:

-- Re-add competition_id columns
ALTER TABLE participants ADD COLUMN competition_id VARCHAR;
ALTER TABLE payments ADD COLUMN competition_id VARCHAR;

-- Recreate competition_status enum
CREATE TYPE competition_status AS ENUM ('draft', 'active', 'completed', 'archived');

-- Recreate competitions table
CREATE TABLE competitions (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    status competition_status NOT NULL DEFAULT 'draft',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    vote_price NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    votes_per_payment INTEGER NOT NULL DEFAULT 1,
    currency VARCHAR NOT NULL DEFAULT 'USD',
    public_leaderboard BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Restore contestant_status enum with all values
ALTER TABLE participants ALTER COLUMN status TYPE VARCHAR(50);
DROP TYPE contestant_status;
CREATE TYPE contestant_status AS ENUM ('draft', 'submitter', 'under_review', 'approved', 'rejected', 'disqualified', 'archived');
UPDATE participants SET status = 'approved' WHERE status IS NULL OR status = '';
ALTER TABLE participants ALTER COLUMN status TYPE contestant_status USING status::contestant_status;
*/
