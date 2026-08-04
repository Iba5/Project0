"""Merge enum lowercase update with refresh token fields

Revision ID: merge_enum_refresh
Revises: update_enum_lowercase, add_refresh_token_fields
Create Date: 2026-08-04

This migration merges the two head revisions:
- update_enum_lowercase (enum value updates)
- add_refresh_token_fields (JWT lifecycle management)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_enum_refresh'
down_revision = ['update_enum_lowercase', 'add_refresh_token_fields']
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This is a merge migration - no actual changes needed
    pass


def downgrade() -> None:
    # To unmerge, we would need to recreate the split
    pass
