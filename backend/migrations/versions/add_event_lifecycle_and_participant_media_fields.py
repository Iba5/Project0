"""Add event lifecycle and participant media fields

Revision ID: add_event_lifecycle_fields
Revises: 58c955045296
Create Date: 2026-08-04

This migration is idempotent - it will skip changes that already exist.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_event_lifecycle_fields'
down_revision = '58c955045296'
branch_labels = None
depends_on = None


def upgrade() -> None:
    from sqlalchemy.sql import text
    conn = op.get_bind()
    
    # Add event lifecycle fields (if not already present)
    # Check and add enable_videos
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'enable_videos'
        )
    """))
    if not result.scalar():
        op.add_column('events', sa.Column('enable_videos', sa.Boolean(), nullable=False, server_default='false'))
    
    # Check and add share_link
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'share_link'
        )
    """))
    if not result.scalar():
        op.add_column('events', sa.Column('share_link', sa.String(), nullable=True))
    
    # Check and add event_id
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'event_id'
        )
    """))
    if not result.scalar():
        op.add_column('events', sa.Column('event_id', sa.String(), nullable=True))
    
    # Add participant media fields (if not already present)
    # Check and add image_url
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'image_url'
        )
    """))
    if not result.scalar():
        op.add_column('participants', sa.Column('image_url', sa.String(), nullable=True))
    
    # Check and add bio
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'bio'
        )
    """))
    if not result.scalar():
        op.add_column('participants', sa.Column('bio', sa.Text(), nullable=True))
    
    # Check and add event_id to participants
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'event_id'
        )
    """))
    if not result.scalar():
        op.add_column('participants', sa.Column('event_id', sa.String(), nullable=True))
    
    # Make participants.video_url nullable (if not already nullable)
    result = conn.execute(text("""
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'participants' AND column_name = 'video_url'
    """))
    video_nullable = result.scalar()
    if video_nullable == 'NO':
        op.execute("UPDATE participants SET video_url = '' WHERE video_url IS NULL")
        op.alter_column('participants', 'video_url', nullable=True)
    
    # Add foreign key constraint (if not already present)
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'participants' 
            AND constraint_name = 'fk_participants_event_id'
            AND constraint_type = 'FOREIGN KEY'
        )
    """))
    if not result.scalar():
        op.create_foreign_key(
            'fk_participants_event_id',
            'participants', 'events', ['event_id'], ['id']
        )


def downgrade() -> None:
    from sqlalchemy.sql import text
    conn = op.get_bind()
    
    # Remove foreign key constraint (if exists)
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'participants' 
            AND constraint_name = 'fk_participants_event_id'
            AND constraint_type = 'FOREIGN KEY'
        )
    """))
    if result.scalar():
        op.drop_constraint('fk_participants_event_id', 'participants', type_='foreignkey')
    
    # Remove participant media fields (if exist)
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'event_id'
        )
    """))
    if result.scalar():
        op.drop_column('participants', 'event_id')
    
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'bio'
        )
    """))
    if result.scalar():
        op.drop_column('participants', 'bio')
    
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'participants' AND column_name = 'image_url'
        )
    """))
    if result.scalar():
        op.drop_column('participants', 'image_url')
    
    # Revert participants.video_url to not nullable (if needed)
    result = conn.execute(text("""
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'participants' AND column_name = 'video_url'
    """))
    video_nullable = result.scalar()
    if video_nullable == 'YES':
        op.execute("UPDATE participants SET video_url = '' WHERE video_url IS NULL")
        op.alter_column('participants', 'video_url', nullable=False)
    
    # Remove event lifecycle fields (if exist)
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'event_id'
        )
    """))
    if result.scalar():
        op.drop_column('events', 'event_id')
    
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'share_link'
        )
    """))
    if result.scalar():
        op.drop_column('events', 'share_link')
    
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'enable_videos'
        )
    """))
    if result.scalar():
        op.drop_column('events', 'enable_videos')
