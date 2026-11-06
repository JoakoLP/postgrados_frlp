from uuid import UUID

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.db.base import Base
from src.inscripcion.infrastructure.models import Cohorte, Legajo


def _new_legajo(cohorte_id: UUID, dni: str) -> Legajo:
    return Legajo(
        cohorte_id=cohorte_id,
        estado="Pendiente",
        carreras=["Especialización"],
        dni=dni,
        apellido="Pérez",
        nombre="Ana",
        nacionalidad="Argentina",
        email=f"{dni}@example.com",
        email_alternativo=f"alt-{dni}@example.com",
        telefono_movil="2215551234",
        domicilio="Calle 1",
        ciudad="La Plata",
        provincia="Buenos Aires",
        pais="Argentina",
        titulo_grado="Ingeniería",
        como_conocio="web",
        motivacion="Quiero profundizar mis conocimientos en esta disciplina.",
        solicita_beca=False,
    )


def test_legajo_persists_with_documents_schema() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        cohorte = Cohorte(anio=2026, nombre="Cohorte 2026", inscripcion_abierta=True)
        session.add(cohorte)
        session.flush()
        legajo = _new_legajo(cohorte.id, "30123456")
        session.add(legajo)
        session.commit()

        assert legajo.id is not None
        assert legajo.estado == "Pendiente"
        assert legajo.carreras == ["Especialización"]


def test_dni_is_unique_within_a_cohort() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        cohorte = Cohorte(anio=2026, nombre="Cohorte 2026", inscripcion_abierta=True)
        session.add(cohorte)
        session.flush()
        session.add(_new_legajo(cohorte.id, "30123456"))
        session.commit()

        session.add(_new_legajo(cohorte.id, "30123456"))
        with pytest.raises(IntegrityError):
            session.commit()

    engine.dispose()
