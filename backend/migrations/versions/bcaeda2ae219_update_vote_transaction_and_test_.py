"""update_vote_transaction_and_test_payment_event_reference

Revision ID: bcaeda2ae219
Revises: 3202b212fb00
Create Date: 2026-08-05 05:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'bcaeda2ae219'
down_revision: Union[str, Sequence[str], None] = '3202b212fb00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    
    # Step 1: Drop competition_id from vote_transactions and test_payments
    try:
        conn.execute(text("ALTER TABLE vote_transactions DROP COLUMN IF EXISTS competition_id"))
    except Exception:
        pass
    
    try:
        conn.execute(text("ALTER TABLE test_payments DROP COLUMN IF EXISTS competition_id"))
    except Exception:
        pass
    
    # Step 2: Add event_id to vote_transactions and test_payments
    try:
        conn.execute(text("ALTER TABLE vote_transactions ADD COLUMN IF NOT EXISTS event_id VARCHAR REFERENCES events(id) ON DELETE SET NULL"))
    except Exception:
        pass
    
    try:
        conn.execute(text("ALTER TABLE test_payments ADD COLUMN IF NOT EXISTS event_id VARCHAR REFERENCES events(id) ON DELETE SET NULL"))
    except Exception:
        pass


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    
    # Step 1: Remove event_id from vote_transactions and test_payments
    try:
        conn.execute(text("ALTER TABLE vote_transactions DROP COLUMN IF EXISTS event_id"))
    except Exception:
        pass
    
    try:
        conn.execute(text("ALTER TABLE test_payments DROP COLUMN IF EXISTS event_id"))
    except Exception:
        pass
    
    # Step 2: Add back competition_id to vote_transactions and test_payments
    try:
        conn.execute(text("ALTER TABLE vote_transactions ADD COLUMN IF NOT EXISTS competition_id VARCHAR REFERENCES competitions(id) ON DELETE SET NULL"))
    except Exception:
        pass
    
    try:
        conn.execute(text("ALTER TABLE test_payments ADD COLUMN IF NOT EXISTS competition_id VARCHAR REFERENCES competitions(id) ON DELETE SET NULL"))
    except Exception:
        pass