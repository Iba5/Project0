"""merge 734b5e91ee76 and add_idempotency_key_to_payments

Revision ID: fe97a81f83b0
Revises: 734b5e91ee76, add_idempotency_key_to_payments
Create Date: 2026-08-01 13:28:10.710814

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fe97a81f83b0'
down_revision: Union[str, Sequence[str], None] = ('734b5e91ee76', 'add_idempotency_key_to_payments')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
