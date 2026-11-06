"""Create core enrollment tables and the open 2026 cohort.

Revision ID: 20261104_0001
Revises:
Create Date: 2026-11-04
"""

from datetime import date
from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision = "20261104_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cohortes",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column(
            "inscripcion_abierta",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("fecha_inicio", sa.Date(), nullable=True),
        sa.UniqueConstraint("anio", name="uq_cohortes_anio"),
        sa.UniqueConstraint("nombre", name="uq_cohortes_nombre"),
    )
    op.bulk_insert(
        sa.table(
            "cohortes",
            sa.column("id", sa.Uuid(as_uuid=True)),
            sa.column("anio", sa.Integer()),
            sa.column("nombre", sa.String()),
            sa.column("inscripcion_abierta", sa.Boolean()),
            sa.column("fecha_inicio", sa.Date()),
        ),
        [
            {
                "id": UUID("c1a2b3c4-0001-0000-0000-000000000003"),
                "anio": 2026,
                "nombre": "Cohorte 2026",
                "inscripcion_abierta": True,
                "fecha_inicio": date(2026, 4, 1),
            }
        ],
    )

    op.create_table(
        "legajos",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("numero_legajo", sa.String(length=40), nullable=True),
        sa.Column("cohorte_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("estado", sa.String(length=30), nullable=False),
        sa.Column("carreras", sa.JSON(), nullable=False),
        sa.Column("dni", sa.String(length=20), nullable=False),
        sa.Column("apellido", sa.String(length=120), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("nacionalidad", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("email_alternativo", sa.String(length=254), nullable=False),
        sa.Column("telefono_movil", sa.String(length=40), nullable=False),
        sa.Column("telefono_fijo", sa.String(length=40), nullable=True),
        sa.Column("domicilio", sa.String(length=200), nullable=False),
        sa.Column("ciudad", sa.String(length=100), nullable=False),
        sa.Column("provincia", sa.String(length=100), nullable=False),
        sa.Column("pais", sa.String(length=100), nullable=False),
        sa.Column("titulo_grado", sa.String(length=200), nullable=False),
        sa.Column("titulo_posgrado", sa.String(length=200), nullable=True),
        sa.Column("como_conocio", sa.String(length=40), nullable=False),
        sa.Column("motivacion", sa.String(length=5000), nullable=False),
        sa.Column("solicita_beca", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("tipo_beca", sa.String(length=10), nullable=True),
        sa.Column(
            "fecha_inscripcion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["cohorte_id"], ["cohortes.id"], name="fk_legajos_cohorte_id_cohortes", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("numero_legajo", name="uq_legajos_numero_legajo"),
        sa.UniqueConstraint("cohorte_id", "dni", name="uq_legajos_cohorte_dni"),
        sa.UniqueConstraint("cohorte_id", "email", name="uq_legajos_cohorte_email"),
    )
    op.create_index("ix_legajos_cohorte_estado", "legajos", ["cohorte_id", "estado"])

    op.create_table(
        "documentos_inscripcion",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("legajo_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("path_storage", sa.String(length=255), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column(
            "fecha_subida",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["legajo_id"], ["legajos.id"], name="fk_documentos_inscripcion_legajo_id_legajos", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("path_storage", name="uq_documentos_inscripcion_path_storage"),
        sa.UniqueConstraint("legajo_id", "tipo", name="uq_documento_legajo_tipo"),
    )


def downgrade() -> None:
    op.drop_table("documentos_inscripcion")
    op.drop_index("ix_legajos_cohorte_estado", table_name="legajos")
    op.drop_table("legajos")
    op.drop_table("cohortes")
