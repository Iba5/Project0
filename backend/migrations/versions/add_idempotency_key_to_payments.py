"""Add idempotency_key column to payments

Revision ID: add_idempotency_key_to_payments
Revises: review_fixes_2024
Create Date: 2026-08-01 12:35:00.000000

Changes:
- Add nullable `idempotency_key` column to `payments` and an index for lookups.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_idempotency_key_to_payments'
down_revision = 'review_fixes_2024'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add idempotency_key column (nullable) and index for fast lookup
    op.add_column('payments', sa.Column('idempotency_key', sa.String(), nullable=True))
    op.create_index('ix_payments_idempotency_key', 'payments', ['idempotency_key'], unique=False)


def downgrade() -> None:
    # Remove index and column
    op.drop_index('ix_payments_idempotency_key', table_name='payments')
    op.drop_column('payments', 'idempotency_key')
