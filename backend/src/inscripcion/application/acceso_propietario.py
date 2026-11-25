import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.inscripcion.infrastructure.models import Legajo

_DURACION_TOKEN_PROPIETARIO = timedelta(days=30)
_ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def generar_codigo_corto() -> str:
    parte_1 = "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(4))
    parte_2 = "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(4))
    return f"{parte_1}-{parte_2}"


@dataclass(frozen=True)
class CredencialPropietario:
    token: str
    token_hash: str
    expira_en: datetime


def crear_credencial_propietario(
    ahora: datetime | None = None,
) -> CredencialPropietario:
    token = generar_codigo_corto()
    return CredencialPropietario(
        token=token,
        token_hash=hashlib.sha256(token.encode("ascii")).hexdigest(),
        expira_en=(ahora or datetime.now(timezone.utc))
        + _DURACION_TOKEN_PROPIETARIO,
    )


def _candidatos_hash(token: str) -> list[str]:
    limpio = token.strip()
    candidatos = [limpio]
    mayus = limpio.upper()
    if mayus != limpio:
        candidatos.append(mayus)
    hashes: list[str] = []
    for candidato in candidatos:
        try:
            hashes.append(hashlib.sha256(candidato.encode("ascii")).hexdigest())
        except UnicodeEncodeError:
            continue
    return hashes


def validar_token_propietario(
    legajo: Legajo,
    token: str,
    ahora: datetime | None = None,
) -> bool:
    if legajo.token_propietario_hash is None or legajo.token_propietario_expira_en is None:
        return False
    hashes = _candidatos_hash(token)
    if not hashes or not any(
        hmac.compare_digest(h, legajo.token_propietario_hash) for h in hashes
    ):
        return False

    expira_en = legajo.token_propietario_expira_en
    if expira_en.tzinfo is None:
        expira_en = expira_en.replace(tzinfo=timezone.utc)
    return expira_en > (ahora or datetime.now(timezone.utc))


def obtener_legajo_por_token(session: Session, token: str) -> Legajo | None:
    hashes = _candidatos_hash(token)
    if not hashes:
        return None
    legajo = session.scalar(
        select(Legajo).where(Legajo.token_propietario_hash.in_(hashes))
    )
    if legajo is None or not validar_token_propietario(legajo, token):
        return None
    return legajo
