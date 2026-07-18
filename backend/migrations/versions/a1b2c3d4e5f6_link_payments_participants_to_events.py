"""link payments and participants to events

Revision ID: a1b2c3d4e5f6
Revises: ad71a2c892e3
Create Date: 2026-07-18 10:30:00.000000

Purpose (FIX 1):
    Add an `event_id` foreign key to both `payments` and `participants` so the
    Paynow callback can resolve the event's vote-pricing rules
    (`vote_price` / `votes_per_payment`) and compute the correct number of
    votes to award, instead of naively truncating the payment currency amount.

    Both columns are nullable so existing rows and the current create flow keep
    working; the service layer populates them whenever an event context is known.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ad71a2c892e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # FIX 1: participants.event_id -> events.id
    op.add_column('participants', sa.Column('event_id', sa.String(), nullable=True))
    op.create_index('ix_participants_event_id', 'participants', ['event_id'])
    op.create_foreign_key(
        'fk_participants_event_id_events',
        'participants',
        'events',
        ['event_id'],
        ['id'],
    )

    # FIX 1: payments.event_id -> events.id
    op.add_column('payments', sa.Column('event_id', sa.String(), nullable=True))
    op.create_index('ix_payments_event_id', 'payments', ['event_id'])
    op.create_foreign_key(
        'fk_payments_event_id_events',
        'payments',
        'events',
        ['event_id'],
        ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_payments_event_id_events', 'payments', type_='foreignkey')
    op.drop_index('ix_payments_event_id', table_name='payments')
    op.drop_column('payments', 'event_id')

    op.drop_constraint('fk_participants_event_id_events', 'participants', type_='foreignkey')
    op.drop_index('ix_participants_event_id', table_name='participants')
    op.drop_column('participants', 'event_id')
