"""Update enum values to lowercase

Revision ID: update_enum_lowercase
Revises: add_event_lifecycle_fields
Create Date: 2026-08-04

This migration updates all enum types to use lowercase values for consistency.
It uses a text conversion approach to safely update enum values.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'update_enum_lowercase'
down_revision = 'add_event_lifecycle_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    from sqlalchemy.sql import text
    conn = op.get_bind()

    # ============================================
    # Update EventStatus enum
    # ============================================
    # Step 1: Convert column to text to allow any value
    op.execute("ALTER TABLE events ALTER COLUMN status TYPE TEXT USING status::text")

    # Step 2: Update existing data to new simplified values
    op.execute("UPDATE events SET status = 'draft' WHERE status = 'DRAFT'")
    op.execute("UPDATE events SET status = 'draft' WHERE status = 'UPCOMING'")
    op.execute("UPDATE events SET status = 'published' WHERE status = 'REGISTRATION_OPEN'")
    op.execute("UPDATE events SET status = 'published' WHERE status = 'VOTING_OPEN'")
    op.execute("UPDATE events SET status = 'cancelled' WHERE status = 'VOTING_CLOSED'")
    op.execute("UPDATE events SET status = 'archived' WHERE status = 'COMPLETED'")
    op.execute("UPDATE events SET status = 'archived' WHERE status = 'ARCHIVED'")

    # Step 3: Drop old enum type if exists
    try:
        op.execute("DROP TYPE eventstatus")
    except Exception:
        pass

    # Step 4: Create new enum type with lowercase values
    op.execute("CREATE TYPE eventstatus AS ENUM ('draft', 'published', 'cancelled', 'archived')")

    # Step 5: Convert column back to enum
    op.execute("ALTER TABLE events ALTER COLUMN status TYPE eventstatus USING status::text::eventstatus")

    # ============================================
    # Update ContestantStatus enum
    # ============================================
    # Step 1: Convert column to text
    op.execute("ALTER TABLE participants ALTER COLUMN status TYPE TEXT USING status::text")

    # Step 2: Update existing data to lowercase
    op.execute("UPDATE participants SET status = 'draft' WHERE status = 'DRAFT'")
    op.execute("UPDATE participants SET status = 'submitted' WHERE status = 'SUBMITTED'")
    op.execute("UPDATE participants SET status = 'under_review' WHERE status = 'UNDER_REVIEW'")
    op.execute("UPDATE participants SET status = 'approved' WHERE status = 'APPROVED'")
    op.execute("UPDATE participants SET status = 'rejected' WHERE status = 'REJECTED'")
    op.execute("UPDATE participants SET status = 'disqualified' WHERE status = 'DISQUALIFIED'")
    op.execute("UPDATE participants SET status = 'archived' WHERE status = 'ARCHIVED'")

    # Step 3: Drop old enum type
    try:
        op.execute("DROP TYPE contestantstatus")
    except Exception:
        pass

    # Step 4: Create new enum type
    op.execute("CREATE TYPE contestantstatus AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disqualified', 'archived')")

    # Step 5: Convert column back to enum
    op.execute("ALTER TABLE participants ALTER COLUMN status TYPE contestantstatus USING status::text::contestantstatus")

    # ============================================
    # Update PaymentStatus enum
    # ============================================
    # Step 1: Convert column to text
    op.execute("ALTER TABLE payments ALTER COLUMN status TYPE TEXT USING status::text")

    # Step 2: Update existing data to lowercase
    op.execute("UPDATE payments SET status = 'created' WHERE status = 'CREATED'")
    op.execute("UPDATE payments SET status = 'pending' WHERE status = 'PENDING'")
    op.execute("UPDATE payments SET status = 'processing' WHERE status = 'PROCESSING'")
    op.execute("UPDATE payments SET status = 'paid' WHERE status = 'PAID'")
    op.execute("UPDATE payments SET status = 'failed' WHERE status = 'FAILED'")
    op.execute("UPDATE payments SET status = 'cancelled' WHERE status = 'CANCELLED'")
    op.execute("UPDATE payments SET status = 'refunded' WHERE status = 'REFUNDED'")
    op.execute("UPDATE payments SET status = 'expired' WHERE status = 'EXPIRED'")

    # Step 3: Drop old enum type
    try:
        op.execute("DROP TYPE paymentstatus")
    except Exception:
        pass

    # Step 4: Create new enum type
    op.execute("CREATE TYPE paymentstatus AS ENUM ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'expired')")

    # Step 5: Convert column back to enum
    op.execute("ALTER TABLE payments ALTER COLUMN status TYPE paymentstatus USING status::text::paymentstatus")

    # ============================================
    # Update SocialPlatform enum
    # ============================================
    # Step 1: Convert column to text
    op.execute("ALTER TABLE participants ALTER COLUMN platform TYPE TEXT USING platform::text")

    # Step 2: Update existing data to lowercase
    op.execute("UPDATE participants SET platform = 'tiktok' WHERE platform = 'TIKTOK'")
    op.execute("UPDATE participants SET platform = 'facebook' WHERE platform = 'FACEBOOK'")
    op.execute("UPDATE participants SET platform = 'instagram' WHERE platform = 'INSTAGRAM'")
    op.execute("UPDATE participants SET platform = 'youtube' WHERE platform = 'YOUTUBE'")

    # Step 3: Drop old enum type
    try:
        op.execute("DROP TYPE socialplatform")
    except Exception:
        pass

    # Step 4: Create new enum type
    op.execute("CREATE TYPE socialplatform AS ENUM ('tiktok', 'facebook', 'instagram', 'youtube')")

    # Step 5: Convert column back to enum
    op.execute("ALTER TABLE participants ALTER COLUMN platform TYPE socialplatform USING platform::text::socialplatform")

    # Step 6: Update social_platforms table as well
    op.execute("ALTER TABLE social_platforms ALTER COLUMN platform TYPE TEXT USING platform::text")
    op.execute("UPDATE social_platforms SET platform = 'tiktok' WHERE platform = 'TIKTOK'")
    op.execute("UPDATE social_platforms SET platform = 'facebook' WHERE platform = 'FACEBOOK'")
    op.execute("UPDATE social_platforms SET platform = 'instagram' WHERE platform = 'INSTAGRAM'")
    op.execute("UPDATE social_platforms SET platform = 'youtube' WHERE platform = 'YOUTUBE'")
    op.execute("ALTER TABLE social_platforms ALTER COLUMN platform TYPE socialplatform USING platform::text::socialplatform")

    # ============================================
    # Update SocialSyncStatus enum
    # ============================================
    # Step 1: Convert column to text
    op.execute("ALTER TABLE social_platforms ALTER COLUMN status TYPE TEXT USING status::text")

    # Step 2: Update existing data to lowercase
    op.execute("UPDATE social_platforms SET status = 'connected' WHERE status = 'CONNECTED'")
    op.execute("UPDATE social_platforms SET status = 'syncing' WHERE status = 'SYNCING'")
    op.execute("UPDATE social_platforms SET status = 'failed' WHERE status = 'FAILED'")
    op.execute("UPDATE social_platforms SET status = 'disconnected' WHERE status = 'DISCONNECTED'")

    # Step 3: Drop old enum type
    try:
        op.execute("DROP TYPE socialsyncstatus")
    except Exception:
        pass

    # Step 4: Create new enum type
    op.execute("CREATE TYPE socialsyncstatus AS ENUM ('connected', 'syncing', 'failed', 'disconnected')")

    # Step 5: Convert column back to enum
    op.execute("ALTER TABLE social_platforms ALTER COLUMN status TYPE socialsyncstatus USING status::text::socialsyncstatus")

    # ============================================
    # Update CompetitionStatus enum (if exists)
    # ============================================
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'competitionstatus'
        )
    """))
    if result.scalar():
        # Step 1: Convert column to text
        op.execute("ALTER TABLE competitions ALTER COLUMN status TYPE TEXT USING status::text")

        # Step 2: Update existing data to lowercase
        op.execute("UPDATE competitions SET status = 'draft' WHERE status = 'DRAFT'")
        op.execute("UPDATE competitions SET status = 'active' WHERE status = 'ACTIVE'")
        op.execute("UPDATE competitions SET status = 'completed' WHERE status = 'COMPLETED'")
        op.execute("UPDATE competitions SET status = 'archived' WHERE status = 'ARCHIVED'")

        # Step 3: Drop old enum type
        try:
            op.execute("DROP TYPE competitionstatus")
        except Exception:
            pass

        # Step 4: Create new enum type
        op.execute("CREATE TYPE competitionstatus AS ENUM ('draft', 'active', 'completed', 'archived')")

        # Step 5: Convert column back to enum
        op.execute("ALTER TABLE competitions ALTER COLUMN status TYPE competitionstatus USING status::text::competitionstatus")

    # ============================================
    # Update UserRole enum (if exists)
    # ============================================
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'userrole'
        )
    """))
    if result.scalar():
        # Step 1: Convert column to text
        op.execute("ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::text")

        # Step 2: Update existing data to lowercase
        op.execute("UPDATE users SET role = 'super_admin' WHERE role = 'SUPER_ADMIN'")
        op.execute("UPDATE users SET role = 'admin' WHERE role = 'ADMIN'")
        op.execute("UPDATE users SET role = 'moderator' WHERE role = 'MODERATOR'")
        op.execute("UPDATE users SET role = 'super_admin' WHERE role = 'Super Admin'")
        op.execute("UPDATE users SET role = 'admin' WHERE role = 'Admin'")
        op.execute("UPDATE users SET role = 'moderator' WHERE role = 'Moderator'")

        # Step 3: Drop old enum type
        try:
            op.execute("DROP TYPE userrole")
        except Exception:
            pass

        # Step 4: Create new enum type
        op.execute("CREATE TYPE userrole AS ENUM ('super_admin', 'admin', 'moderator')")

        # Step 5: Convert column back to enum
        op.execute("ALTER TABLE users ALTER COLUMN role TYPE userrole USING role::text::userrole")


def downgrade() -> None:
    from sqlalchemy.sql import text
    conn = op.get_bind()

    # Reverse all changes - convert back to title case

    # ============================================
    # Revert EventStatus
    # ============================================
    op.execute("ALTER TABLE events ALTER COLUMN status TYPE TEXT USING status::text")
    op.execute("UPDATE events SET status = 'Draft' WHERE status = 'draft'")
    op.execute("UPDATE events SET status = 'Published' WHERE status = 'published'")
    op.execute("UPDATE events SET status = 'Cancelled' WHERE status = 'cancelled'")
    op.execute("UPDATE events SET status = 'Archived' WHERE status = 'archived'")

    try:
        op.execute("DROP TYPE eventstatus")
    except Exception:
        pass

    op.execute("CREATE TYPE eventstatus AS ENUM ('Draft', 'Published', 'Cancelled', 'Archived')")
    op.execute("ALTER TABLE events ALTER COLUMN status TYPE eventstatus USING status::text::eventstatus")

    # ============================================
    # Revert ContestantStatus
    # ============================================
    op.execute("ALTER TABLE participants ALTER COLUMN status TYPE TEXT USING status::text")
    op.execute("UPDATE participants SET status = 'Draft' WHERE status = 'draft'")
    op.execute("UPDATE participants SET status = 'Submitted' WHERE status = 'submitted'")
    op.execute("UPDATE participants SET status = 'Under Review' WHERE status = 'under_review'")
    op.execute("UPDATE participants SET status = 'Approved' WHERE status = 'approved'")
    op.execute("UPDATE participants SET status = 'Rejected' WHERE status = 'rejected'")
    op.execute("UPDATE participants SET status = 'Disqualified' WHERE status = 'disqualified'")
    op.execute("UPDATE participants SET status = 'Archived' WHERE status = 'archived'")

    try:
        op.execute("DROP TYPE contestantstatus")
    except Exception:
        pass

    op.execute("CREATE TYPE contestantstatus AS ENUM ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Disqualified', 'Archived')")
    op.execute("ALTER TABLE participants ALTER COLUMN status TYPE contestantstatus USING status::text::contestantstatus")

    # ============================================
    # Revert PaymentStatus
    # ============================================
    op.execute("ALTER TABLE payments ALTER COLUMN status TYPE TEXT USING status::text")
    op.execute("UPDATE payments SET status = 'Created' WHERE status = 'created'")
    op.execute("UPDATE payments SET status = 'Pending' WHERE status = 'pending'")
    op.execute("UPDATE payments SET status = 'Processing' WHERE status = 'processing'")
    op.execute("UPDATE payments SET status = 'Paid' WHERE status = 'paid'")
    op.execute("UPDATE payments SET status = 'Failed' WHERE status = 'failed'")
    op.execute("UPDATE payments SET status = 'Cancelled' WHERE status = 'cancelled'")
    op.execute("UPDATE payments SET status = 'Refunded' WHERE status = 'refunded'")
    op.execute("UPDATE payments SET status = 'Expired' WHERE status = 'expired'")

    try:
        op.execute("DROP TYPE paymentstatus")
    except Exception:
        pass

    op.execute("CREATE TYPE paymentstatus AS ENUM ('Created', 'Pending', 'Processing', 'Paid', 'Failed', 'Cancelled', 'Refunded', 'Expired')")
    op.execute("ALTER TABLE payments ALTER COLUMN status TYPE paymentstatus USING status::text::paymentstatus")

    # ============================================
    # Revert SocialPlatform
    # ============================================
    op.execute("ALTER TABLE participants ALTER COLUMN platform TYPE TEXT USING platform::text")
    op.execute("UPDATE participants SET platform = 'TikTok' WHERE platform = 'tiktok'")
    op.execute("UPDATE participants SET platform = 'Facebook' WHERE platform = 'facebook'")
    op.execute("UPDATE participants SET platform = 'Instagram' WHERE platform = 'instagram'")
    op.execute("UPDATE participants SET platform = 'YouTube' WHERE platform = 'youtube'")

    try:
        op.execute("DROP TYPE socialplatform")
    except Exception:
        pass

    op.execute("CREATE TYPE socialplatform AS ENUM ('TikTok', 'Facebook', 'Instagram', 'YouTube')")
    op.execute("ALTER TABLE participants ALTER COLUMN platform TYPE socialplatform USING platform::text::socialplatform")

    op.execute("ALTER TABLE social_platforms ALTER COLUMN platform TYPE TEXT USING platform::text")
    op.execute("UPDATE social_platforms SET platform = 'TikTok' WHERE platform = 'tiktok'")
    op.execute("UPDATE social_platforms SET platform = 'Facebook' WHERE platform = 'facebook'")
    op.execute("UPDATE social_platforms SET platform = 'Instagram' WHERE platform = 'instagram'")
    op.execute("UPDATE social_platforms SET platform = 'YouTube' WHERE platform = 'youtube'")
    op.execute("ALTER TABLE social_platforms ALTER COLUMN platform TYPE socialplatform USING platform::text::socialplatform")

    # ============================================
    # Revert SocialSyncStatus
    # ============================================
    op.execute("ALTER TABLE social_platforms ALTER COLUMN status TYPE TEXT USING status::text")
    op.execute("UPDATE social_platforms SET status = 'Connected' WHERE status = 'connected'")
    op.execute("UPDATE social_platforms SET status = 'Syncing' WHERE status = 'syncing'")
    op.execute("UPDATE social_platforms SET status = 'Failed' WHERE status = 'failed'")
    op.execute("UPDATE social_platforms SET status = 'Disconnected' WHERE status = 'disconnected'")

    try:
        op.execute("DROP TYPE socialsyncstatus")
    except Exception:
        pass

    op.execute("CREATE TYPE socialsyncstatus AS ENUM ('Connected', 'Syncing', 'Failed', 'Disconnected')")
    op.execute("ALTER TABLE social_platforms ALTER COLUMN status TYPE socialsyncstatus USING status::text::socialsyncstatus")

    # ============================================
    # Revert CompetitionStatus (if exists)
    # ============================================
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'competitionstatus'
        )
    """))
    if result.scalar():
        op.execute("ALTER TABLE competitions ALTER COLUMN status TYPE TEXT USING status::text")
        op.execute("UPDATE competitions SET status = 'Draft' WHERE status = 'draft'")
        op.execute("UPDATE competitions SET status = 'Active' WHERE status = 'active'")
        op.execute("UPDATE competitions SET status = 'Completed' WHERE status = 'completed'")
        op.execute("UPDATE competitions SET status = 'Archived' WHERE status = 'archived'")

        try:
            op.execute("DROP TYPE competitionstatus")
        except Exception:
            pass

        op.execute("CREATE TYPE competitionstatus AS ENUM ('Draft', 'Active', 'Completed', 'Archived')")
        op.execute("ALTER TABLE competitions ALTER COLUMN status TYPE competitionstatus USING status::text::competitionstatus")

    # ============================================
    # Revert UserRole (if exists)
    # ============================================
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'userrole'
        )
    """))
    if result.scalar():
        op.execute("ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::text")
        op.execute("UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'super_admin'")
        op.execute("UPDATE users SET role = 'ADMIN' WHERE role = 'admin'")
        op.execute("UPDATE users SET role = 'MODERATOR' WHERE role = 'moderator'")

        try:
            op.execute("DROP TYPE userrole")
        except Exception:
            pass

        op.execute("CREATE TYPE userrole AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR')")
        op.execute("ALTER TABLE users ALTER COLUMN role TYPE userrole USING role::text::userrole")
