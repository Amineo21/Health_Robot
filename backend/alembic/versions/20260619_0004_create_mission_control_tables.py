"""create mission control tables

Revision ID: 20260619_0004
Revises: 20260615_0003
Create Date: 2026-06-19
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260619_0004"
down_revision: str | None = "20260615_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "annotated_points",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("yaw", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_annotated_points_is_active"), "annotated_points", ["is_active"], unique=False)
    op.create_index(op.f("ix_annotated_points_type"), "annotated_points", ["type"], unique=False)

    op.create_table(
        "stock_point_supplies",
        sa.Column("stock_point_id", sa.String(length=64), nullable=False),
        sa.Column("supply_type", sa.String(length=64), nullable=False),
        sa.Column("priority_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["stock_point_id"], ["annotated_points.id"]),
        sa.PrimaryKeyConstraint("stock_point_id", "supply_type"),
    )
    op.create_index(op.f("ix_stock_point_supplies_is_active"), "stock_point_supplies", ["is_active"], unique=False)

    op.create_table(
        "missions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("supply_type", sa.String(length=64), nullable=False),
        sa.Column("delivery_room_id", sa.String(length=64), nullable=False),
        sa.Column("delivery_room_name_snapshot", sa.String(length=160), nullable=False),
        sa.Column("delivery_x_snapshot", sa.Float(), nullable=False),
        sa.Column("delivery_y_snapshot", sa.Float(), nullable=False),
        sa.Column("delivery_yaw_snapshot", sa.Float(), nullable=False),
        sa.Column("stock_point_id", sa.String(length=64), nullable=False),
        sa.Column("stock_point_name_snapshot", sa.String(length=160), nullable=False),
        sa.Column("stock_x_snapshot", sa.Float(), nullable=False),
        sa.Column("stock_y_snapshot", sa.Float(), nullable=False),
        sa.Column("stock_yaw_snapshot", sa.Float(), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=64), nullable=False),
        sa.Column("created_by_name_snapshot", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("arrived_at_stock_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_confirmed_by_user_id", sa.String(length=64), nullable=True),
        sa.Column("arrived_at_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_confirmed_by_user_id", sa.String(length=64), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by_user_id", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.String(length=300), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_missions_created_at"), "missions", ["created_at"], unique=False)
    op.create_index(op.f("ix_missions_created_by_user_id"), "missions", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_missions_delivery_room_id"), "missions", ["delivery_room_id"], unique=False)
    op.create_index(op.f("ix_missions_status"), "missions", ["status"], unique=False)
    op.create_index(op.f("ix_missions_stock_point_id"), "missions", ["stock_point_id"], unique=False)
    op.create_index(op.f("ix_missions_supply_type"), "missions", ["supply_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_missions_supply_type"), table_name="missions")
    op.drop_index(op.f("ix_missions_stock_point_id"), table_name="missions")
    op.drop_index(op.f("ix_missions_status"), table_name="missions")
    op.drop_index(op.f("ix_missions_delivery_room_id"), table_name="missions")
    op.drop_index(op.f("ix_missions_created_by_user_id"), table_name="missions")
    op.drop_index(op.f("ix_missions_created_at"), table_name="missions")
    op.drop_table("missions")
    op.drop_index(op.f("ix_stock_point_supplies_is_active"), table_name="stock_point_supplies")
    op.drop_table("stock_point_supplies")
    op.drop_index(op.f("ix_annotated_points_type"), table_name="annotated_points")
    op.drop_index(op.f("ix_annotated_points_is_active"), table_name="annotated_points")
    op.drop_table("annotated_points")
