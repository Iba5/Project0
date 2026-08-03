"""add payment method configuration table

Revision ID: add_payment_method_configs
Revises: add_refresh_token_fields
Create Date: 2026-08-02 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_payment_method_configs'
down_revision: Union[str, Sequence[str], None] = None  # Will be merged
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create payment_method_configs table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS payment_method_configs (
            id VARCHAR(255) PRIMARY KEY,
            method VARCHAR(50) NOT NULL UNIQUE,
            method_type VARCHAR(20) NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            description TEXT,
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            icon_name VARCHAR(50),
            config_data JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        """
    )
    
    # Insert default payment methods
    op.execute(
        """
        INSERT INTO payment_method_configs (id, method, method_type, display_name, description, is_enabled, sort_order, icon_name, config_data) VALUES
        ('visa_method', 'visa', 'web', 'Visa', 'Pay with Visa card', TRUE, 1, 'credit-card', NULL),
        ('mastercard_method', 'mastercard', 'web', 'MasterCard', 'Pay with MasterCard', TRUE, 2, 'credit-card', NULL),
        ('paypal_method', 'paypal', 'web', 'PayPal', 'Pay with PayPal', TRUE, 3, 'paypal', NULL),
        ('ecocash_method', 'ecocash', 'mobile', 'EcoCash', 'Pay with EcoCash mobile money', TRUE, 4, 'smartphone', NULL),
        ('onemoney_method', 'onemoney', 'mobile', 'OneMoney', 'Pay with OneMoney mobile money', TRUE, 5, 'smartphone', NULL),
        ('zipit_method', 'zipit', 'mobile', 'Zipit', 'Pay with Zipit mobile money', FALSE, 6, 'smartphone', NULL),
        ('voucher_method', 'voucher', 'offline', 'Voucher', 'Pay with offline voucher', FALSE, 7, 'ticket', NULL)
        ON CONFLICT (method) DO NOTHING;
        """
    )
    
    # Create index on is_enabled for quick filtering
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_payment_method_configs_enabled ON payment_method_configs(is_enabled);
        """
    )
    
    # Create index on sort_order for ordered retrieval
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_payment_method_configs_sort ON payment_method_configs(sort_order);
        """
    )


def downgrade() -> None:
    # Drop the indexes
    op.execute("DROP INDEX IF EXISTS ix_payment_method_configs_sort;")
    op.execute("DROP INDEX IF EXISTS ix_payment_method_configs_enabled;")
    
    # Drop the table
    op.execute("DROP TABLE IF EXISTS payment_method_configs;")
