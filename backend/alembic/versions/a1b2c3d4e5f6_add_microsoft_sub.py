"""add microsoft_sub to users

Revision ID: a1b2c3d4e5f6
Revises: b3627699c66f
Create Date: 2026-05-25 00:00:00.000000

"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b3627699c66f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('microsoft_sub', sa.String(length=200), nullable=True))
    op.create_index(op.f('ix_users_microsoft_sub'), 'users', ['microsoft_sub'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_microsoft_sub'), table_name='users')
    op.drop_column('users', 'microsoft_sub')
