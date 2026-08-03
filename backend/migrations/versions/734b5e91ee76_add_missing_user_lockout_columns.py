"""add missing user lockout columns

Revision ID: 734b5e91ee76
Revises: eef6e0be5718
Create Date: 2026-07-18 21:46:49.611317

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '734b5e91ee76'
down_revision: Union[str, Sequence[str], None] = 'eef6e0be5718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Use IF NOT EXISTS to make this migration idempotent across databases
    # Some environments already have these columns (created manually or by other means).
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0 NOT NULL;
        """
    )

    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE NULL;
        """
    )


def downgrade():
    # Use IF EXISTS to avoid errors if columns are already removed or absent.
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS locked_until;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS failed_login_count;")