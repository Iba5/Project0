"""Add competitions, voter tracking, source_platform, poll_url, and scoping

Revision ID: b1c2d3e4f5a6
Revises: ad71a2c892e3
Create Date: 2025-07-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'ad71a2c892e3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===================================================================
    # 1. CREATE competitions table
    # ===================================================================
    op.create_table(
        'competitions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='Draft'),  # C5: Model uses CompetitionStatus enum; ensure values match
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('vote_price', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('votes_per_payment', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('currency', sa.String(), nullable=False, server_default='USD'),
        sa.Column('public_leaderboard', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_competitions_is_active', 'competitions', ['is_active'])

    # ===================================================================
    # 2. ADD competition_id FK to events
    # ===================================================================
    op.add_column('events', sa.Column('competition_id', sa.String(), nullable=True))
    op.create_index('ix_events_competition_id', 'events', ['competition_id'])
    op.create_foreign_key('fk_events_competition', 'events', 'competitions', 
                           ['competition_id'], ['id'])

    # ===================================================================
    # 3. ADD competition_id FK to participants
    # ===================================================================
    op.add_column('participants', sa.Column('competition_id', sa.String(), nullable=True))
    op.create_index('ix_participants_competition_id', 'participants', ['competition_id'])
    op.create_foreign_key('fk_participants_competition', 'participants', 'competitions',
                           ['competition_id'], ['id'])

    # ===================================================================
    # 4. ADD new columns to payments
    # ===================================================================
    # Paynow integration fields
    op.add_column('payments', sa.Column('poll_url', sa.String(), nullable=True))
    op.create_index('ix_payments_poll_url', 'payments', ['poll_url'])
    op.add_column('payments', sa.Column('paynow_redirect_url', sa.String(), nullable=True))

    # Voter identification fields
    op.add_column('payments', sa.Column('voter_phone', sa.String(), nullable=True))
    op.create_index('ix_payments_voter_phone', 'payments', ['voter_phone'])
    op.add_column('payments', sa.Column('voter_name', sa.String(), nullable=True))
    op.add_column('payments', sa.Column('voter_email', sa.String(), nullable=True))

    # Traffic source tracking
    op.add_column('payments', sa.Column('source_platform', sa.String(), nullable=True))
    op.create_index('ix_payments_source_platform', 'payments', ['source_platform'])

    # Competition scoping
    op.add_column('payments', sa.Column('competition_id', sa.String(), nullable=True))
    op.create_index('ix_payments_competition_id', 'payments', ['competition_id'])
    op.create_foreign_key('fk_payments_competition', 'payments', 'competitions',
                           ['competition_id'], ['id'])

    # Duplicate vote acknowledgement
    op.add_column('payments', sa.Column('duplicate_vote_acknowledged', sa.Boolean(), 
                                         nullable=False, server_default='0'))

    # ===================================================================
    # 5. ADD competition_id to vote_transactions
    # ===================================================================
    op.add_column('vote_transactions', sa.Column('competition_id', sa.String(), nullable=True))
    op.create_index('ix_vote_transactions_competition_id', 'vote_transactions', ['competition_id'])
    op.create_foreign_key('fk_vote_transactions_competition', 'vote_transactions', 'competitions',
                           ['competition_id'], ['id'])


def downgrade() -> None:
    # Drop vote_transactions competition FK
    op.drop_constraint('fk_vote_transactions_competition', 'vote_transactions', type_='foreignkey')
    op.drop_index('ix_vote_transactions_competition_id', table_name='vote_transactions')
    op.drop_column('vote_transactions', 'competition_id')

    # Drop payments new columns
    op.drop_constraint('fk_payments_competition', 'payments', type_='foreignkey')
    op.drop_index('ix_payments_competition_id', table_name='payments')
    op.drop_column('payments', 'competition_id')
    op.drop_column('payments', 'duplicate_vote_acknowledged')
    op.drop_index('ix_payments_source_platform', table_name='payments')
    op.drop_column('payments', 'source_platform')
    op.drop_column('payments', 'voter_email')
    op.drop_column('payments', 'voter_name')
    op.drop_index('ix_payments_voter_phone', table_name='payments')
    op.drop_column('payments', 'voter_phone')
    op.drop_column('payments', 'paynow_redirect_url')
    op.drop_index('ix_payments_poll_url', table_name='payments')
    op.drop_column('payments', 'poll_url')

    # Drop participants competition FK
    op.drop_constraint('fk_participants_competition', 'participants', type_='foreignkey')
    op.drop_index('ix_participants_competition_id', table_name='participants')
    op.drop_column('participants', 'competition_id')

    # Drop events competition FK
    op.drop_constraint('fk_events_competition', 'events', type_='foreignkey')
    op.drop_index('ix_events_competition_id', table_name='events')
    op.drop_column('events', 'competition_id')

    # Drop competitions table
    op.drop_index('ix_competitions_is_active', table_name='competitions')
    op.drop_table('competitions')