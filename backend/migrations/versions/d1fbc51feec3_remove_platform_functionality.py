"""remove_platform_functionality

Revision ID: d1fbc51feec3
Revises: merge_enum_refresh
Create Date: 2026-08-04 23:14:42.414335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = 'd1fbc51feec3'
down_revision: Union[str, Sequence[str], None] = 'update_enum_lowercase'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove platform functionality from the database."""
    conn = op.get_bind()

    # 1. Drop platform column from participants table
    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS platform")

    # 2. Drop source_platform column from payments table
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS source_platform")

    # 3. Drop source_platform column from test_payments table
    op.execute("ALTER TABLE test_payments DROP COLUMN IF EXISTS source_platform")

    # 4. Drop social_platforms table
    op.execute("DROP TABLE IF EXISTS social_platforms CASCADE")

    # 5. Drop socialplatform enum type
    try:
        op.execute("DROP TYPE IF EXISTS socialplatform")
    except Exception:
        pass

    conn.commit()


def downgrade() -> None:
    """Restore platform functionality (for rollback)."""
    conn = op.get_bind()

    # 1. Recreate socialplatform enum type
    op.execute("CREATE TYPE socialplatform AS ENUM ('tiktok', 'facebook', 'instagram', 'youtube')")

    # 2. Recreate social_platforms table
    op.execute("""
        CREATE TABLE social_platforms (
            id VARCHAR PRIMARY KEY,
            platform socialplatform NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'disconnected',
            last_sync TIMESTAMP WITH TIME ZONE,
            detail VARCHAR
        )
    """)

    # 3. Add platform column back to participants table
    op.execute("ALTER TABLE participants ADD COLUMN IF NOT EXISTS platform socialplatform")

    # 4. Add source_platform column back to payments table
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS source_platform VARCHAR")

    # 5. Add source_platform column back to test_payments table
    op.execute("ALTER TABLE test_payments ADD COLUMN IF NOT EXISTS source_platform VARCHAR")

    conn.commit()
