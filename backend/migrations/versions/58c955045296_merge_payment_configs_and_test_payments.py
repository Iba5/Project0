"""merge_payment_configs_and_test_payments

Revision ID: 58c955045296
Revises: add_payment_method_configs, fe8d06520d01
Create Date: 2026-08-04 01:02:30.202478

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58c955045296'
down_revision: Union[str, Sequence[str], None] = ('add_payment_method_configs', 'fe8d06520d01')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
