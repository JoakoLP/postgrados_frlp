import json
from datetime import date
from http import HTTPStatus
from io import BytesIO
from typing import TypedDict
from unicodedata import normalize
from uuid import UUID
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import Select, String, cast, or_, select
from sqlalchemy.orm import Session, selectinload

from src.autenticacion.infraestructura.modelos import User
from src.db.session import get_db
from src.inscripcion.application.acceso_propietario import obtener_legajo_por_token
from src.inscripcion.application.estado_documental import evaluar_estado_documental
from src.inscripcion.infrastructure.models import Cohorte, Legajo
from src.inscripcion.presentation.schemas import (
    Carrera,
    EstadoDocumentalResponse,
    LegajoDetalleResponse,
    LegajoListadoResponse,
    SeguimientoConsultaRequest,
)
from src.inscripcion.presentation.acceso_legajo import (
    autorizar_dueno_o_coordinador,
    bearer_scheme,
    exigir_credencial,
)
from src.shared.autorizacion.permisos import requerir_roles
from src.shared.http.excel import generar_excel

router = APIRouter(prefix="/api/v1/legajos", tags=["legajos"])
_MAXIMO_FILAS_EXPORTACION = 500
_TIPO_DOCUMENTO_BECA = "FORM_BECA"


class FiltrosLegajos(TypedDict):
    estado: str | None
    cohorte_id: UUID | None
    carrera: Carrera | None
    tiene_beca: bool | None
    dni: str | None
    apellido: str | None


def _consulta_legajos(
    *,
    estado: str | None,
    cohorte_id: UUID | None,
    carrera: Carrera | None,
    tiene_beca: bool | None,
    dni: str | None,
    apellido: str | None,
) -> Select[tuple[Legajo]]:
    consulta = select(Legajo)
    if estado:
        consulta = consulta.where(Legajo.estado == estado.strip())
    if cohorte_id is not None:
        consulta = consulta.where(Legajo.cohorte_id == cohorte_id)
    if carrera:
        carreras_serializadas = cast(Legajo.carreras, String)
        consulta = consulta.where(
            or_(
                carreras_serializadas.ilike(f'%"{carrera}"%'),
                carreras_serializadas.ilike(
                    f"%{json.dumps(carrera, ensure_ascii=True)}%"
                ),
            )
        )
    if tiene_beca is not None:
        consulta = consulta.where(Legajo.solicita_beca.is_(tiene_beca))
    if dni:
        consulta = consulta.where(Legajo.dni == dni.strip())
    if apellido is not None and apellido.isascii():
        apellido_literal = apellido.strip().replace("\\", "\\\\")
        apellido_literal = apellido_literal.replace("%", "\\%").replace("_", "\\_")
        consulta = consulta.where(
            Legajo.apellido.ilike(
                f"%{apellido_literal}%",
                escape="\\",
            )
        )
    return consulta.order_by(Legajo.fecha_inscripcion.desc(), Legajo.apellido)


def _parametros_filtro(
    estado: str | None,
    cohorte_id: UUID | None,
    carrera: Carrera | None,
    tiene_beca: bool | None,
    dni: str | None,
    apellido: str | None,
) -> FiltrosLegajos:
    return {
        "estado": estado,
        "cohorte_id": cohorte_id,
        "carrera": carrera,
        "tiene_beca": tiene_beca,
        "dni": dni,
        "apellido": apellido,
    }


def _obtener_legajos(
    session: Session,
    consulta: Select[tuple[Legajo]],
    *,
    apellido: str | None,
    incluir_documentos: bool,
) -> list[Legajo]:
    if incluir_documentos and apellido is None:
        return list(
            session.scalars(consulta.options(selectinload(Legajo.documentos)))
        )

    registros = list(session.scalars(consulta))
    if apellido is not None:
        texto_busqueda = normalize("NFC", apellido.strip()).casefold()
        registros = [
            legajo
            for legajo in registros
            if texto_busqueda in normalize("NFC", legajo.apellido).casefold()
        ]
    if not incluir_documentos or not registros:
        return registros

    ids_registros = [legajo.id for legajo in registros]
    con_documentos: dict[UUID, Legajo] = {}
    for inicio in range(0, len(ids_registros), 500):
        lote_ids = ids_registros[inicio : inicio + 500]
        con_documentos.update(
            {
                legajo.id: legajo
                for legajo in session.scalars(
                    select(Legajo)
                    .options(selectinload(Legajo.documentos))
                    .where(Legajo.id.in_(lote_ids))
                )
            }
        )
    return [con_documentos[legajo.id] for legajo in registros]


def _documento_beca(legajo: Legajo) -> dict[str, str] | None:
    documento = next(
        (doc for doc in legajo.documentos if doc.tipo == _TIPO_DOCUMENTO_BECA),
        None,
    )
    return {"tipo": documento.tipo} if documento is not None else None


def _legajo_listado(legajo: Legajo) -> LegajoListadoResponse:
    return LegajoListadoResponse(
        id=legajo.id,
        numero_legajo=legajo.numero_legajo,
        apellido=legajo.apellido,
        nombre=legajo.nombre,
        dni=legajo.dni,
        estado=legajo.estado,
        carreras=legajo.carreras,
        solicita_beca=legajo.solicita_beca,
        tipo_beca=legajo.tipo_beca,
        documento_beca=_documento_beca(legajo),
    )


@router.get("", response_model=list[LegajoListadoResponse])
def listar_legajos(
    estado: str | None = Query(default=None, max_length=30),
    cohorte_id: UUID | None = None,
    carrera: Carrera | None = None,
    tiene_beca: bool | None = None,
    dni: str | None = Query(default=None, max_length=20),
    apellido: str | None = Query(default=None, min_length=3, max_length=120),
    session: Session = Depends(get_db),
    _: User = Depends(requerir_roles("COORDINADOR")),
) -> list[LegajoListadoResponse]:
    if apellido is not None and len(apellido.strip()) < 3:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail="La búsqueda por apellido requiere al menos tres caracteres",
        )
    registros = _obtener_legajos(
        session,
        _consulta_legajos(**_parametros_filtro(
            estado, cohorte_id, carrera, tiene_beca, dni, apellido
        )),
        apellido=apellido,
        incluir_documentos=True,
    )
    return [_legajo_listado(legajo) for legajo in registros]


@router.get("/exportar")
def exportar_legajos(
    estado: str | None = Query(default=None, max_length=30),
    cohorte_id: UUID | None = None,
    carrera: Carrera | None = None,
    tiene_beca: bool | None = None,
    dni: str | None = Query(default=None, max_length=20),
    apellido: str | None = Query(default=None, min_length=3, max_length=120),
    session: Session = Depends(get_db),
    _: User = Depends(requerir_roles("COORDINADOR")),
) -> StreamingResponse:
    if apellido is not None and len(apellido.strip()) < 3:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail="La búsqueda por apellido requiere al menos tres caracteres",
        )
    registros = _obtener_legajos(
        session,
        _consulta_legajos(**_parametros_filtro(
            estado, cohorte_id, carrera, tiene_beca, dni, apellido
        )),
        apellido=apellido,
        incluir_documentos=False,
    )
    if len(registros) > _MAXIMO_FILAS_EXPORTACION:
        raise HTTPException(
            status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            detail=f"La exportación admite hasta {_MAXIMO_FILAS_EXPORTACION} legajos",
        )

    encabezados = [
        "N.º de legajo",
        "Apellido",
        "Nombre",
        "DNI",
        "Estado",
        "Carreras",
        "Solicita beca",
        "Tipo de beca",
        "Fecha de inscripción",
    ]
    filas = [encabezados]
    for legajo in registros:
        filas.append(
            [
                legajo.numero_legajo or "",
                legajo.apellido,
                legajo.nombre,
                legajo.dni,
                legajo.estado,
                ", ".join(legajo.carreras),
                "Sí" if legajo.solicita_beca else "No",
                legajo.tipo_beca or "",
                legajo.fecha_inscripcion.date().isoformat() if legajo.fecha_inscripcion else "",
            ]
        )

    cohorte = session.get(Cohorte, cohorte_id) if cohorte_id is not None else None
    sufijo_cohorte = f"cohorte{cohorte.anio}" if cohorte is not None else "cohortes"
    metadatos_filtro = {
        "Cohorte": cohorte.nombre if cohorte is not None else "Todas",
        "Estado": estado or "Todos",
        "Carrera": carrera or "Todas",
        "Solicita beca": "Sí" if tiene_beca is True else ("No" if tiene_beca is False else "Todos"),
        "Total de registros": str(len(registros)),
    }
    salida = generar_excel(filas, "Legajos", metadatos=metadatos_filtro)
    return StreamingResponse(
        salida,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="inscriptos-{sufijo_cohorte}-'
                f'{date.today():%Y-%m-%d}.xlsx"'
            ),
            "Cache-Control": "private, no-store",
        },
    )


def _coincide_identificador(legajo: Legajo, identificador: str) -> bool:
    limpio = identificador.strip()
    if "@" in limpio:
        return legajo.email.lower() == limpio.lower()
    dni_limpio = limpio.replace(".", "").replace(" ", "")
    return legajo.dni == dni_limpio or legajo.email.lower() == limpio.lower()


def _construir_detalle_legajo(legajo: Legajo) -> LegajoDetalleResponse:
    evaluacion = evaluar_estado_documental(legajo)
    return LegajoDetalleResponse(
        id=legajo.id,
        numero_legajo=legajo.numero_legajo,
        cohorte_id=legajo.cohorte_id,
        estado=legajo.estado,
        carreras=legajo.carreras,
        dni=legajo.dni,
        apellido=legajo.apellido,
        nombre=legajo.nombre,
        nacionalidad=legajo.nacionalidad,
        email=legajo.email,
        email_alternativo=legajo.email_alternativo,
        telefono_movil=legajo.telefono_movil,
        telefono_fijo=legajo.telefono_fijo,
        domicilio=legajo.domicilio,
        ciudad=legajo.ciudad,
        provincia=legajo.provincia,
        pais=legajo.pais,
        titulo_grado=legajo.titulo_grado,
        titulo_posgrado=legajo.titulo_posgrado,
        como_conocio=legajo.como_conocio,
        motivacion=legajo.motivacion,
        solicita_beca=legajo.solicita_beca,
        tipo_beca=legajo.tipo_beca,
        fecha_inscripcion=legajo.fecha_inscripcion,
        documentos=[
            {
                "id": documento.id,
                "tipo": documento.tipo,
                "fecha_subida": documento.fecha_subida,
            }
            for documento in legajo.documentos
        ],
        documentacion_completa=evaluacion.completo,
        estado_documental=evaluacion.estado,
        documentos_faltantes=list(evaluacion.faltantes),
    )


@router.post("/seguimiento", response_model=LegajoDetalleResponse)
def consultar_seguimiento(
    solicitud: SeguimientoConsultaRequest,
    session: Session = Depends(get_db),
) -> LegajoDetalleResponse:
    legajo = obtener_legajo_por_token(session, solicitud.codigo)
    if legajo is None or not _coincide_identificador(legajo, solicitud.identificador):
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Email/DNI o código de acceso inválido o vencido",
        )
    legajo_con_docs = session.scalar(
        select(Legajo)
        .options(selectinload(Legajo.documentos))
        .where(Legajo.id == legajo.id)
    )
    return _construir_detalle_legajo(legajo_con_docs or legajo)


@router.get("/{id}", response_model=LegajoDetalleResponse)
def obtener_legajo(
    id: UUID,
    session: Session = Depends(get_db),
    credenciales: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> LegajoDetalleResponse:
    credenciales = exigir_credencial(credenciales)
    legajo = session.scalar(
        select(Legajo)
        .options(selectinload(Legajo.documentos))
        .where(Legajo.id == id)
    )
    if legajo is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail="No se encontró el legajo solicitado",
        )
    autorizar_dueno_o_coordinador(legajo, credenciales, session)
    return _construir_detalle_legajo(legajo)


@router.get("/{id}/estado-documental", response_model=EstadoDocumentalResponse)
def obtener_estado_documental_legajo(
    id: UUID,
    session: Session = Depends(get_db),
    credenciales: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> EstadoDocumentalResponse:
    credenciales = exigir_credencial(credenciales)
    legajo = session.scalar(
        select(Legajo)
        .options(selectinload(Legajo.documentos))
        .where(Legajo.id == id)
    )
    if legajo is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail="No se encontró el legajo solicitado",
        )
    autorizar_dueno_o_coordinador(legajo, credenciales, session)
    evaluacion = evaluar_estado_documental(legajo, verificar_archivos=True)
    return EstadoDocumentalResponse(
        estado=evaluacion.estado,
        completo=evaluacion.completo,
        validado=evaluacion.validado,
        requeridos=list(evaluacion.requeridos),
        presentes=list(evaluacion.presentes),
        faltantes=list(evaluacion.faltantes),
        invalidos=list(evaluacion.invalidos),
        opcionales_presentes=list(evaluacion.opcionales_presentes),
    )
