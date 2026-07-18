"""Fix critical review issues: Numeric columns, login lockout, indexes

Revision ID: review_fixes_2024
Revises: b1c2d3e4f5a6
Create Date: 2024-01-01 00:00:00.000000

Changes:
- C5: Float → Numeric(10,2) for Payment.amount, Competition.vote_price, Event.vote_price
- H2: Add User.failed_login_count and User.locked_until for brute-force protection
- H7: Add index on Payment.date for date-ordered queries
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'review_fixes_2024'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # C5: Convert Float to Numeric for monetary columns
    # PostgreSQL handles ALTER COLUMN TYPE with USING for implicit cast
    op.alter_column('payments', 'amount',
                    existing_type=sa.Float(),
                    type_=sa.Numeric(10, 2),
                    existing_nullable=False)

    op.alter_column('competitions', 'vote_price',
                    existing_type=sa.Float(),
                    type_=sa.Numeric(10, 2),
                    existing_nullable=False)

    op.alter_column('events', 'vote_price',
                    existing_type=sa.Float(),
                    type_=sa.Numeric(10, 2),
                    existing_nullable=True)

    # H2: Add account lockout columns to users table
    op.add_column('users', sa.Column('failed_login_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))

    # H7: Create index on payments.date (may already exist)
    op.create_index('ix_payments_date', 'payments', ['date'], unique=False)


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_payments_date', table_name='payments')

    # Remove lockout columns
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_count')

    # Revert Numeric → Float
    op.alter_column('events', 'vote_price',
                    existing_type=sa.Numeric(10, 2),
                    type_=sa.Float(),
                    existing_nullable=True)

    op.alter_column('competitions', 'vote_price',
                    existing_type=sa.Numeric(10, 2),
                    type_=sa.Float(),
                    existing_nullable=False)

    op.alter_column('payments', 'amount',
                    existing_type=sa.Numeric(10, 2),
                    type_=sa.Float(),
                    existing_nullable=False)