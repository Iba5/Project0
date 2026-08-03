"""add refresh token fields for JWT lifecycle management

Revision ID: add_refresh_token_fields
Revises: fe97a81f83b0
Create Date: 2026-08-02 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_refresh_token_fields'
down_revision: Union[str, Sequence[str], None] = 'fe97a81f83b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add refresh_token column
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(255) UNIQUE NULL;
        """
    )
    
    # Add refresh_token_expires column
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS refresh_token_expires TIMESTAMP WITH TIME ZONE NULL;
        """
    )
    
    # Create index on refresh_token for faster lookups
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_users_refresh_token ON users(refresh_token);
        """
    )


def downgrade() -> None:
    # Drop the index
    op.execute("DROP INDEX IF EXISTS ix_users_refresh_token;")
    
    # Drop the columns
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS refresh_token_expires;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS refresh_token;")