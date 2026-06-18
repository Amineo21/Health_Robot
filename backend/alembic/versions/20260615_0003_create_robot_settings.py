"""create robot settings table

Revision ID: 20260615_0003
Revises: 20260614_0002
Create Date: 2026-06-15
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260615_0003"
down_revision: str | None = "20260614_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "robot_settings",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("max_speed_mps", sa.Float(), nullable=False),
        sa.Column("meal_speed_mps", sa.Float(), nullable=False),
        sa.Column("low_battery_threshold", sa.Integer(), nullable=False),
        sa.Column("auto_return_enabled", sa.Boolean(), nullable=False),
        sa.Column("teleop_enabled", sa.Boolean(), nullable=False),
        sa.Column("emergency_requires_admin_reset", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("robot_settings")
