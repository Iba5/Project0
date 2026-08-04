"""remove_competition_model_and_update_references

Revision ID: 3202b212fb00
Revises: 19cf880cb6cb
Create Date: 2026-08-05 04:08:39.404111

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3202b212fb00'
down_revision: Union[str, Sequence[str], None] = '19cf880cb6cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import text
    
    conn = op.get_bind()
    
    # Step 1: Handle contestant_status enum
    try:
        # Check if enum exists
        result = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'contestant_status'"))
        enum_exists = result.fetchone() is not None
        
        if enum_exists:
            # Get current values
            result = conn.execute(text("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contestant_status') ORDER BY enumsortorder"))
            current_values = [row[0] for row in result.fetchall()]
            
            # If it has more than just approved/disqualified, we need to recreate it
            if set(current_values) != {'approved', 'disqualified'}:
                # Convert to text first
                conn.execute(text("ALTER TABLE participants ALTER COLUMN status TYPE VARCHAR(50)"))
                # Drop old enum
                conn.execute(text("DROP TYPE contestant_status"))
                # Create new enum
                conn.execute(text("CREATE TYPE contestant_status AS ENUM ('approved', 'disqualified')"))
                # Convert back, defaulting to approved
                conn.execute(text("UPDATE participants SET status = 'approved' WHERE status NOT IN ('approved', 'disqualified')"))
                conn.execute(text("ALTER TABLE participants ALTER COLUMN status TYPE contestant_status USING status::contestant_status"))
    except Exception as e:
        print(f"Warning during contestant_status migration: {e}")
        # Try to continue anyway
    
    # Step 2: Drop competition_id columns
    try:
        conn.execute(text("ALTER TABLE participants DROP COLUMN IF EXISTS competition_id"))
    except Exception:
        pass
    
    try:
        conn.execute(text("ALTER TABLE payments DROP COLUMN IF EXISTS competition_id"))
    except Exception:
        pass
    
    # Step 3: Drop competitions table
    try:
        conn.execute(text("DROP TABLE IF EXISTS competitions CASCADE"))
    except Exception:
        pass
    
    # Step 4: Drop competition_status enum
    try:
        conn.execute(text("DROP TYPE IF EXISTS competition_status CASCADE"))
    except Exception:
        pass


def downgrade() -> None:
    """Downgrade schema."""
    from sqlalchemy import text
    
    conn = op.get_bind()
    
    # Step 1: Recreate competition_status enum
    conn.execute(text("CREATE TYPE competition_status AS ENUM ('draft', 'active', 'completed', 'archived')"))
    
    # Step 2: Recreate competitions table
    conn.execute(text("""
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
        )
    """))
    
    # Step 3: Add back competition_id columns
    try:
        conn.execute(text("ALTER TABLE participants ADD COLUMN competition_id VARCHAR"))
    except Exception:
        pass  # Column might already exist
    
    try:
        conn.execute(text("ALTER TABLE payments ADD COLUMN competition_id VARCHAR"))
    except Exception:
        pass  # Column might already exist
    
    # Step 4: Restore contestant_status enum
    try:
        # Convert to text first
        conn.execute(text("ALTER TABLE participants ALTER COLUMN status TYPE VARCHAR(50)"))
        # Drop old enum
        conn.execute(text("DROP TYPE contestant_status"))
        # Create new enum with all values
        conn.execute(text("CREATE TYPE contestant_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disqualified', 'archived')"))
        # Convert back, defaulting to approved
        conn.execute(text("UPDATE participants SET status = 'approved' WHERE status IS NULL OR status = ''"))
        conn.execute(text("ALTER TABLE participants ALTER COLUMN status TYPE contestant_status USING status::contestant_status"))
    except Exception as e:
        print(f"Warning during contestant_status downgrade: {e}")
