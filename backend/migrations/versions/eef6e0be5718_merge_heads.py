"""merge heads

Revision ID: eef6e0be5718
Revises: 068af20d4b64, review_fixes_2024
Create Date: 2026-07-18 21:33:09.876894

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eef6e0be5718'
down_revision: Union[str, Sequence[str], None] = ('068af20d4b64', 'review_fixes_2024')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
