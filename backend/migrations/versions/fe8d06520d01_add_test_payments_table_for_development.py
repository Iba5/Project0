"""add_test_payments_table_for_development

Revision ID: fe8d06520d01
Revises: add_payment_method_configs
Create Date: 2026-08-04 01:00:28.709494

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'fe8d06520d01'
down_revision: Union[str, Sequence[str], None] = None  # Will be merged
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create test_payments table for development testing."""
    op.create_table(
        'test_payments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('reference', sa.String(), nullable=False),
        sa.Column('contestant_id', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('voter_phone', sa.String(), nullable=True),
        sa.Column('voter_email', sa.String(), nullable=True),
        sa.Column('source_platform', sa.String(), nullable=True),
        sa.Column('competition_id', sa.String(), nullable=True),
        sa.Column('test_redirect_url', sa.String(), nullable=True),
        sa.Column('is_test_payment', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('test_response_data', postgresql.JSON(), nullable=True),
        sa.Column('auto_complete', sa.Boolean(), nullable=False),
        sa.Column('test_completion_delay', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reference')
    )
    op.create_index(op.f('ix_test_payments_reference'), 'test_payments', ['reference'], unique=False)


def downgrade() -> None:
    """Downgrade schema - drop test_payments table."""
    op.drop_index(op.f('ix_test_payments_reference'), table_name='test_payments')
    op.drop_table('test_payments')
