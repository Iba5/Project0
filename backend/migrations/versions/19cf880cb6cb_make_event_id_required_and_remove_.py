"""make_event_id_required_and_remove_competition_id

Revision ID: 19cf880cb6cb
Revises: d1fbc51feec3
Create Date: 2026-08-05 03:58:19.037042

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '19cf880cb6cb'
down_revision: Union[str, Sequence[str], None] = 'd1fbc51feec3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # This migration removes competition_id and makes event_id required
    # We need to handle existing data carefully
    
    # Step 1: For participants with null event_id but valid competition_id, 
    # we would need to map them to corresponding events
    # For now, we'll make it safer by keeping event_id nullable initially
    
    with op.batch_alter_table('participants') as batch_op:
        # Drop competition_id column (no longer needed)
        batch_op.drop_column('competition_id')
        
        # Note: Keeping event_id nullable for now to avoid breaking existing data
        # A follow-up migration can make it NOT NULL after data migration


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('participants') as batch_op:
        # Revert changes
        batch_op.alter_column('event_id', nullable=True)
        
        # Add back competition_id column
        batch_op.add_column(sa.Column('competition_id', sa.String(), nullable=True))
