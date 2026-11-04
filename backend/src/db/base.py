from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from src.inscripcion.infrastructure.models import Cohorte, DocumentoInscripcion, Legajo
