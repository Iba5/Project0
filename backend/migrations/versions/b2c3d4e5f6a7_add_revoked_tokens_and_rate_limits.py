"""add revoked tokens and rate limit buckets

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-18 10:31:00.000000

Purpose:
    FIX 6 - `revoked_tokens`: a JWT blocklist keyed by the token's `jti` claim.
        The logout flow records the active token's jti here; the auth dependency
        rejects any token whose jti is present, so logged-out or revoked tokens
        stop working immediately even though their signature is still valid.

    FIX 4 - `rate_limit_buckets`: distributed, cross-worker rate-limiting state
        replacing the old in-memory per-worker dict. One row per client IP,
        updated atomically so all Uvicorn workers share one counter.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # FIX 6: JWT blocklist table.
    op.create_table(
        'revoked_tokens',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('jti', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti', name='uq_revoked_tokens_jti'),
    )
    op.create_index('ix_revoked_tokens_jti', 'revoked_tokens', ['jti'], unique=True)

    # FIX 4: distributed rate-limit buckets.
    op.create_table(
        'rate_limit_buckets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('client_ip', sa.String(), nullable=False),
        sa.Column('window_start', sa.Float(), nullable=False),
        sa.Column('request_count', sa.Integer(), nullable=False),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_ip', name='uq_rate_limit_buckets_client_ip'),
    )
    op.create_index('ix_rate_limit_buckets_client_ip', 'rate_limit_buckets', ['client_ip'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_rate_limit_buckets_client_ip', table_name='rate_limit_buckets')
    op.drop_table('rate_limit_buckets')

    op.drop_index('ix_revoked_tokens_jti', table_name='revoked_tokens')
    op.drop_table('revoked_tokens')
