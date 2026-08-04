# Supabase Migration Instructions

## Current Status

The backend code has been updated to remove the Competition model and simplify participant status, but these changes have **not yet been applied to the Supabase database**. The local PostgreSQL database has been migrated via Alembic, but Supabase needs manual SQL execution.

## Migration Required

### Changes to Apply:
1. **Remove Competition model** - Drop competitions table and competition_status enum
2. **Simplify participant status** - Change contestant_status enum from 7 values to 2 (approved, disqualified)
3. **Remove competition_id references** - Drop competition_id columns from participants and payments tables
4. **Make event_id required** - Participant creation now requires event_id

## How to Apply Migration

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `backend/supabase_remove_competition_and_simplify_participant_status.sql`
4. **Run each section separately** (highlight and execute each section one at a time):
   - Section 1: Update contestant_status enum
   - Section 2: Remove competition_id columns  
   - Section 3: Drop competitions table
   - Section 4: Drop competition_status enum
   - Section 6: Verification queries (to confirm changes)

### Option 2: Using psql Command Line

```bash
# Connect to your Supabase database
psql -h db.[your-project-ref].supabase.co -U postgres -d postgres

# Run the migration script
\i backend/supabase_remove_competition_and_simplify_participant_status.sql
```

### Option 3: Using Supabase CLI

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link your project
supabase link --project-ref [your-project-ref]

# Run the migration
supabase db execute -f backend/supabase_remove_competition_and_simplify_participant_status.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check contestant_status enum (should only show approved, disqualified)
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contestant_status')
ORDER BY enumsortorder;

-- Check competitions table is gone
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'competitions';

-- Check competition_status enum is gone
SELECT typname FROM pg_type WHERE typname = 'competition_status';

-- Check participants table structure (should not have competition_id)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'participants' 
ORDER BY ordinal_position;
```

## Expected Results

After successful migration:

### contestant_status enum:
- `approved`
- `disqualified`

### Tables removed:
- `competitions`

### Enums removed:
- `competition_status`

### Columns removed:
- `participants.competition_id`
- `payments.competition_id`

### Participants table columns (expected):
- `id` (varchar, primary key)
- `name` (varchar, not null)
- `category` (varchar, not null)
- `video_url` (varchar, nullable)
- `image_url` (varchar, nullable)
- `bio` (text, nullable)
- `status` (contestant_status, not null, default 'approved')
- `votes` (integer, default 0)
- `created_at` (timestamp with time zone, not null)
- `deleted_at` (timestamp with time zone, nullable)
- `event_id` (varchar, nullable, indexed) ← **Now the key relationship**

## Rollback

If you need to revert these changes, the SQL script includes a rollback section at the bottom (commented out). Uncomment and run the rollback SQL.

## Important Notes

1. **Data Loss Warning**: 
   - Dropping the competitions table will delete all competition data
   - Existing participants with competition_id will lose that reference
   - Ensure you have a backup if you need the competition data

2. **Participant Status**:
   - All existing participants will be set to 'approved' status
   - Any participants with other statuses (draft, submitted, under_review, rejected, disqualified, archived) will be converted to 'approved'

3. **Event Dependency**:
   - Participant creation now requires event_id
   - Ensure you have events created before adding participants
   - The frontend event dropdown will only show events with open registration

4. **Testing**:
   - After migration, test participant creation/editing
   - Test event creation and participant filtering
   - Test leaderboard functionality
   - Test payment processing

## Post-Migration Checklist

- [ ] Migration applied successfully to Supabase
- [ ] contestant_status enum has only 2 values
- [ ] competitions table is removed
- [ ] competition_status enum is removed
- [ ] competition_id columns removed from participants and payments
- [ ] Participants can be created with event_id
- [ ] Participant status shows approved/disqualified only
- [ ] Frontend loads participants correctly
- [ ] Event dropdown shows events for participant creation
- [ ] Bulk actions work with new status system

## Support

If you encounter any issues during migration:
1. Check the error message carefully
2. Verify you have the right database permissions
3. Run the verification queries to check current state
4. Use the rollback script if needed
5. Check backend logs for any schema mismatch errors
