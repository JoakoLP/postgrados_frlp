from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.autenticacion.aplicacion.seguridad import hash_password
from src.autenticacion.infraestructura.modelos import User
from src.carga_academica.infraestructura.modelos import (
    AsistenciaSeminario,
    ClaseSeminario,
    InscripcionSeminario,
    Seminario,
)
from src.core.config import settings
from src.db.session import SessionLocal
from src.inscripcion.application.estado_documental import DOCUMENTOS_OBLIGATORIOS_BASE
from src.inscripcion.infrastructure.models import Cohorte, DocumentoInscripcion, Legajo
from src.seguimiento_graduacion.aplicacion.semaforos import recalcular_semaforos
from src.seguimiento_graduacion.infraestructura.modelos import (
    AsignacionCoordinador,
    AvanceTesis,
    PlanGraduacion,
    TrabajoFinal,
)
from src.shared.auditoria.modelos import EventoAuditoria

DEVELOPMENT_USERS = (
    ("admin@fenix.test", "Admin1234!", "COORDINADOR"),
    ("cpr@fenix.test", "Cpr1234!", "CPR"),
    ("sistema@fenix.test", "Sistema1234!", "ADMIN"),
)


def _construir_pdf_ejemplo(etiqueta: str) -> bytes:
    texto = f"Documento de prueba UTN FRLP - {etiqueta}".encode("latin-1", errors="replace")
    contenido_stream = b"BT /F1 12 Tf 50 750 Td (" + texto + b") Tj ET"
    return (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        b"4 0 obj << /Length "
        + str(len(contenido_stream)).encode("ascii")
        + b" >> stream\n"
        + contenido_stream
        + b"\nendstream endobj\n"
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    )


def _asegurar_documento_pdf(
    session: Session,
    *,
    legajo: Legajo,
    tipo: str,
    fecha_subida: datetime,
    raiz_storage: Path,
) -> None:
    existente = session.scalar(
        select(DocumentoInscripcion).where(
            DocumentoInscripcion.legajo_id == legajo.id,
            DocumentoInscripcion.tipo == tipo,
        )
    )
    if existente is not None:
        return

    rel_path = f"seed/{legajo.dni}_{tipo.lower()}.pdf"
    contenido = _construir_pdf_ejemplo(f"{legajo.apellido}, {legajo.nombre} ({legajo.dni}) - {tipo}")
    checksum = sha256(contenido).hexdigest()

    try:
        destino = raiz_storage / rel_path
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(contenido)
    except OSError:
        # En entornos donde el directorio de storage sea de solo lectura, aún registramos el metadato.
        pass

    session.add(
        DocumentoInscripcion(
            legajo_id=legajo.id,
            tipo=tipo,
            path_storage=rel_path,
            checksum_sha256=checksum,
            fecha_subida=fecha_subida,
        )
    )


def _seed_usuarios(session: Session) -> dict[str, User]:
    usuarios: dict[str, User] = {}
    for email, password, role in DEVELOPMENT_USERS:
        existing = session.scalar(select(User).where(User.email == email))
        if existing is None:
            existing = User(
                email=email,
                password_hash=hash_password(password),
                role=role,
            )
            session.add(existing)
            session.flush()
        usuarios[email] = existing
    return usuarios


def _seed_cohortes(session: Session, hoy: date) -> dict[int, Cohorte]:
    definiciones = (
        {
            "anio": 2024,
            "nombre": "Cohorte 2024",
            "inscripcion_abierta": False,
            "fecha_inicio": date(2024, 3, 11),
            "fecha_proxima_apertura": None,
        },
        {
            "anio": 2025,
            "nombre": "Cohorte 2025",
            "inscripcion_abierta": False,
            "fecha_inicio": date(2025, 3, 10),
            "fecha_proxima_apertura": None,
        },
        {
            "anio": 2026,
            "nombre": "Cohorte 2026",
            "inscripcion_abierta": True,
            "fecha_inicio": date(2026, 3, 16),
            "fecha_proxima_apertura": None,
        },
        {
            "anio": 2027,
            "nombre": "Cohorte 2027",
            "inscripcion_abierta": False,
            "fecha_inicio": date(2027, 3, 15),
            "fecha_proxima_apertura": max(date(2027, 2, 1), hoy + timedelta(days=45)),
        },
    )
    cohortes: dict[int, Cohorte] = {}
    for datos in definiciones:
        anio = datos["anio"]
        cohorte = session.scalar(select(Cohorte).where(Cohorte.anio == anio))
        if cohorte is None:
            cohorte = Cohorte(**datos)
            session.add(cohorte)
            session.flush()
        else:
            if cohorte.fecha_inicio is None:
                cohorte.fecha_inicio = datos["fecha_inicio"]
        cohortes[anio] = cohorte
    return cohortes


def _seed_legajos(
    session: Session,
    cohortes: dict[int, Cohorte],
    ahora: datetime,
    coordinador: User,
) -> dict[str, Legajo]:
    motivacion_base = (
        "Mi objetivo profesional es profundizar mis conocimientos científicos y metodológicos "
        "en la UTN FRLP para aplicarlos en proyectos de investigación, desarrollo tecnológico "
        "y transferencia en el ámbito industrial y académico regional."
    )

    especificaciones: list[dict[str, Any]] = [
        # ── COHORTE 2026 (Inscripción abierta y cursada actual) ──
        {
            "clave": "2026_pendiente_beca",
            "anio": 2026,
            "numero_legajo": None,
            "estado": "Pendiente",
            "carreras": ["Especialización"],
            "dni": "40112233",
            "nombre": "Lucía",
            "apellido": "Fernández",
            "email": "lucia.fernandez@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera en Sistemas de Información",
            "titulo_posgrado": None,
            "como_conocio": "web",
            "solicita_beca": True,
            "tipo_beca": "30%",
            "dias_atras": 6,
            "documentos_completos": True,
        },
        {
            "clave": "2026_pendiente_incompleto",
            "anio": 2026,
            "numero_legajo": None,
            "estado": "Pendiente",
            "carreras": ["Maestría"],
            "dni": "41223344",
            "nombre": "Tomás",
            "apellido": "Pereyra",
            "email": "tomas.pereyra@alumno.frlp.utn.edu.ar",
            "ciudad": "Berisso",
            "provincia": "Buenos Aires",
            "titulo_grado": "Licenciado en Informática",
            "titulo_posgrado": None,
            "como_conocio": "redes",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 4,
            "documentos_completos": False,
        },
        {
            "clave": "2026_en_revision",
            "anio": 2026,
            "numero_legajo": None,
            "estado": "En Revisión",
            "carreras": ["Doctorado"],
            "dni": "36334455",
            "nombre": "Carolina",
            "apellido": "Domínguez",
            "email": "carolina.dominguez@alumno.frlp.utn.edu.ar",
            "ciudad": "City Bell",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Química",
            "titulo_posgrado": "Magíster en Ingeniería Ambiental",
            "como_conocio": "colegas",
            "solicita_beca": True,
            "tipo_beca": "100%",
            "dias_atras": 14,
            "documentos_completos": True,
        },
        {
            "clave": "2026_observado",
            "anio": 2026,
            "numero_legajo": None,
            "estado": "Observado",
            "carreras": ["Especialización", "Maestría"],
            "dni": "39445566",
            "nombre": "Nicolás",
            "apellido": "Sánchez",
            "email": "nicolas.sanchez@alumno.frlp.utn.edu.ar",
            "ciudad": "Ensenada",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Industrial",
            "titulo_posgrado": None,
            "como_conocio": "egresados",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 18,
            "documentos_completos": False,
        },
        {
            "clave": "2026_completado",
            "anio": 2026,
            "numero_legajo": "26-001-001",
            "estado": "Completado",
            "carreras": ["Maestría"],
            "dni": "38556677",
            "nombre": "Julieta",
            "apellido": "Bianchi",
            "email": "julieta.bianchi@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Civil",
            "titulo_posgrado": None,
            "como_conocio": "web",
            "solicita_beca": True,
            "tipo_beca": "30%",
            "dias_atras": 12,
            "documentos_completos": True,
        },
        {
            "clave": "2026_rechazado",
            "anio": 2026,
            "numero_legajo": None,
            "estado": "Rechazado",
            "carreras": ["Especialización"],
            "dni": "42667788",
            "nombre": "Ramiro",
            "apellido": "Acosta",
            "email": "ramiro.acosta@alumno.frlp.utn.edu.ar",
            "ciudad": "Quilmes",
            "provincia": "Buenos Aires",
            "titulo_grado": "Técnico Universitario en Programación",
            "titulo_posgrado": None,
            "como_conocio": "redes",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 25,
            "documentos_completos": True,
        },
        {
            "clave": "2026_activo_esp",
            "anio": 2026,
            "numero_legajo": "26-001-002",
            "estado": "Activo",
            "carreras": ["Especialización"],
            "dni": "37778899",
            "nombre": "Valentina",
            "apellido": "Moreno",
            "email": "valentina.moreno@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera en Sistemas de Información",
            "titulo_posgrado": None,
            "como_conocio": "egresados",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 180,
            "documentos_completos": True,
        },
        {
            "clave": "2026_activo_mae",
            "anio": 2026,
            "numero_legajo": "26-001-003",
            "estado": "Activo",
            "carreras": ["Maestría"],
            "dni": "35889900",
            "nombre": "Martín",
            "apellido": "Gómez",
            "email": "martin.gomez@alumno.frlp.utn.edu.ar",
            "ciudad": "Gonnet",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Mecánico",
            "titulo_posgrado": "Especialista en Gestión de Operaciones",
            "como_conocio": "colegas",
            "solicita_beca": True,
            "tipo_beca": "100%",
            "dias_atras": 210,
            "documentos_completos": True,
        },
        {
            "clave": "2026_activo_doc",
            "anio": 2026,
            "numero_legajo": "26-001-004",
            "estado": "Activo",
            "carreras": ["Doctorado"],
            "dni": "33990011",
            "nombre": "Sofía",
            "apellido": "Navarro",
            "email": "sofia.navarro@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Electrónica",
            "titulo_posgrado": "Magíster en Procesamiento de Señales",
            "como_conocio": "web",
            "solicita_beca": True,
            "tipo_beca": "100%",
            "dias_atras": 220,
            "documentos_completos": True,
        },
        # ── COHORTE 2025 (Semáforos en ROJO, AMARILLO, Graduados y Bajas) ──
        {
            "clave": "2025_rojo_esp",
            "anio": 2025,
            "numero_legajo": "25-001-001",
            "estado": "Activo",
            "carreras": ["Especialización"],
            "dni": "34101112",
            "nombre": "Federico",
            "apellido": "Ríos",
            "email": "federico.rios@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero en Sistemas de Información",
            "titulo_posgrado": None,
            "como_conocio": "colegas",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 600,  # > 75% de 730d (547.5d) y adeuda seminario -> ROJO
            "documentos_completos": True,
        },
        {
            "clave": "2025_amarillo_esp",
            "anio": 2025,
            "numero_legajo": "25-001-002",
            "estado": "Activo",
            "carreras": ["Especialización"],
            "dni": "35202122",
            "nombre": "Agustina",
            "apellido": "Ledesma",
            "email": "agustina.ledesma@alumno.frlp.utn.edu.ar",
            "ciudad": "Tolosa",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Industrial",
            "titulo_posgrado": None,
            "como_conocio": "web",
            "solicita_beca": True,
            "tipo_beca": "30%",
            "dias_atras": 430,  # > 50% de 730d (365d), seminarios aprobados pero sin TFI -> AMARILLO
            "documentos_completos": True,
        },
        {
            "clave": "2025_amarillo_mae",
            "anio": 2025,
            "numero_legajo": "25-001-003",
            "estado": "Activo",
            "carreras": ["Maestría"],
            "dni": "34303132",
            "nombre": "Gonzalo",
            "apellido": "Vega",
            "email": "gonzalo.vega@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Electromecánico",
            "titulo_posgrado": None,
            "como_conocio": "egresados",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 620,  # > 50% de 1095d (547.5d), sin director asignado -> AMARILLO
            "documentos_completos": True,
        },
        {
            "clave": "2025_verde_mae",
            "anio": 2025,
            "numero_legajo": "25-001-004",
            "estado": "Activo",
            "carreras": ["Maestría"],
            "dni": "36404142",
            "nombre": "Camila",
            "apellido": "Ortega",
            "email": "camila.ortega@alumno.frlp.utn.edu.ar",
            "ciudad": "Villa Elisa",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera en Sistemas de Información",
            "titulo_posgrado": None,
            "como_conocio": "web",
            "solicita_beca": True,
            "tipo_beca": "100%",
            "dias_atras": 580,  # Con director y seminarios aprobados -> VERDE
            "documentos_completos": True,
        },
        {
            "clave": "2025_graduado_esp",
            "anio": 2025,
            "numero_legajo": "25-001-005",
            "estado": "Graduado",
            "carreras": ["Especialización"],
            "dni": "32505152",
            "nombre": "Hernán",
            "apellido": "Castro",
            "email": "hernan.castro@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Civil",
            "titulo_posgrado": None,
            "como_conocio": "colegas",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 590,
            "dias_graduacion": 480,
            "documentos_completos": True,
        },
        {
            "clave": "2025_baja_mae",
            "anio": 2025,
            "numero_legajo": "25-001-006",
            "estado": "Baja",
            "carreras": ["Maestría"],
            "dni": "37606162",
            "nombre": "Florencia",
            "apellido": "Molina",
            "email": "florencia.molina@alumno.frlp.utn.edu.ar",
            "ciudad": "Berazategui",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Química",
            "titulo_posgrado": None,
            "como_conocio": "redes",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 560,
            "documentos_completos": True,
        },
        {
            "clave": "2025_vencido_esp",
            "anio": 2025,
            "numero_legajo": "25-001-007",
            "estado": "Vencido",
            "carreras": ["Especialización"],
            "dni": "39707172",
            "nombre": "Ezequiel",
            "apellido": "Paz",
            "email": "ezequiel.paz@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Industrial",
            "titulo_posgrado": None,
            "como_conocio": "otro",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 540,
            "documentos_completos": True,
        },
        # ── COHORTE 2024 (Casos avanzados, ROJO en Maestría/Doctorado y Graduados) ──
        {
            "clave": "2024_rojo_mae",
            "anio": 2024,
            "numero_legajo": "24-001-001",
            "estado": "Activo",
            "carreras": ["Maestría"],
            "dni": "31808182",
            "nombre": "Sebastián",
            "apellido": "Méndez",
            "email": "sebastian.mendez@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero en Sistemas de Información",
            "titulo_posgrado": None,
            "como_conocio": "colegas",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 930,  # > 80% de 1095d (876d) y adeuda seminario -> ROJO
            "documentos_completos": True,
        },
        {
            "clave": "2024_rojo_doc",
            "anio": 2024,
            "numero_legajo": "24-001-002",
            "estado": "Activo",
            "carreras": ["Doctorado"],
            "dni": "30909192",
            "nombre": "Mariana",
            "apellido": "Villalba",
            "email": "mariana.villalba@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Química",
            "titulo_posgrado": "Magíster en Ingeniería de Procesos",
            "como_conocio": "egresados",
            "solicita_beca": True,
            "tipo_beca": "100%",
            "dias_atras": 1320,  # > 70% de 1825d (1277.5d) y sin aprobación CPR -> ROJO
            "documentos_completos": True,
        },
        {
            "clave": "2024_graduado_mae",
            "anio": 2024,
            "numero_legajo": "24-001-003",
            "estado": "Graduado",
            "carreras": ["Maestría"],
            "dni": "29111213",
            "nombre": "Alejandro",
            "apellido": "Quiroga",
            "email": "alejandro.quiroga@alumno.frlp.utn.edu.ar",
            "ciudad": "City Bell",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Electrónico",
            "titulo_posgrado": None,
            "como_conocio": "web",
            "solicita_beca": True,
            "tipo_beca": "30%",
            "dias_atras": 960,
            "dias_graduacion": 780,
            "documentos_completos": True,
        },
        {
            "clave": "2024_graduado_esp",
            "anio": 2024,
            "numero_legajo": "24-001-004",
            "estado": "Graduado",
            "carreras": ["Especialización"],
            "dni": "33212223",
            "nombre": "Paula",
            "apellido": "Giménez",
            "email": "paula.gimenez@alumno.frlp.utn.edu.ar",
            "ciudad": "La Plata",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniera Industrial",
            "titulo_posgrado": None,
            "como_conocio": "egresados",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 950,
            "dias_graduacion": 540,
            "documentos_completos": True,
        },
        {
            "clave": "2024_baja_doc",
            "anio": 2024,
            "numero_legajo": "24-001-005",
            "estado": "Baja",
            "carreras": ["Doctorado"],
            "dni": "31313233",
            "nombre": "Diego",
            "apellido": "Benítez",
            "email": "diego.benitez@alumno.frlp.utn.edu.ar",
            "ciudad": "Avellaneda",
            "provincia": "Buenos Aires",
            "titulo_grado": "Ingeniero Mecánico",
            "titulo_posgrado": "Magíster en Energías Renovables",
            "como_conocio": "colegas",
            "solicita_beca": False,
            "tipo_beca": None,
            "dias_atras": 940,
            "documentos_completos": True,
        },
    ]

    raiz_storage = Path(settings.storage_path)
    legajos_por_clave: dict[str, Legajo] = {}

    for indice, item in enumerate(especificaciones, start=1):
        cohorte = cohortes[item["anio"]]
        fecha_inscripcion = ahora - timedelta(days=item["dias_atras"])
        legajo = session.scalar(
            select(Legajo).where(
                Legajo.cohorte_id == cohorte.id,
                Legajo.dni == item["dni"],
            )
        )
        if legajo is None:
            legajo = Legajo(
                numero_legajo=item["numero_legajo"],
                cohorte_id=cohorte.id,
                estado=item["estado"],
                carreras=item["carreras"],
                dni=item["dni"],
                apellido=item["apellido"],
                nombre=item["nombre"],
                nacionalidad="Argentina",
                email=item["email"],
                email_alternativo=f"alt.{item['email']}",
                telefono_movil=f"+54 9 221 555-{1000 + indice:04d}",
                telefono_fijo=f"0221 421-{2000 + indice:04d}" if indice % 2 == 0 else None,
                domicilio=f"Calle {40 + indice} N° {700 + indice * 11}",
                ciudad=item["ciudad"],
                provincia=item["provincia"],
                pais="Argentina",
                titulo_grado=item["titulo_grado"],
                titulo_posgrado=item["titulo_posgrado"],
                como_conocio=item["como_conocio"],
                motivacion=motivacion_base,
                solicita_beca=item["solicita_beca"],
                tipo_beca=item["tipo_beca"],
                fecha_inscripcion=fecha_inscripcion,
            )
            session.add(legajo)
            session.flush()

        # Documentos asociados
        tipos_doc = (
            list(DOCUMENTOS_OBLIGATORIOS_BASE)
            if item["documentos_completos"]
            else ["FORM_INSCRIPCION", "DNI", "TITULO"]
        )
        if item["documentos_completos"] and item["titulo_posgrado"]:
            tipos_doc.append("TITULO_POSGRADO")
        if item["documentos_completos"] and item["solicita_beca"]:
            tipos_doc.append("FORM_BECA")

        for tipo_doc in tipos_doc:
            _asegurar_documento_pdf(
                session,
                legajo=legajo,
                tipo=tipo_doc,
                fecha_subida=fecha_inscripcion + timedelta(hours=2),
                raiz_storage=raiz_storage,
            )

        # Evento de auditoría de graduación para métricas de tiempo promedio en Panel de Conducción
        if item["estado"] == "Graduado" and "dias_graduacion" in item:
            evento_existente = session.scalar(
                select(EventoAuditoria).where(
                    EventoAuditoria.tipo_recurso == "legajo",
                    EventoAuditoria.id_recurso == str(legajo.id),
                    EventoAuditoria.accion == "legajo.transicion",
                )
            )
            if evento_existente is None:
                fecha_graduacion = fecha_inscripcion + timedelta(days=item["dias_graduacion"])
                session.add(
                    EventoAuditoria(
                        accion="legajo.transicion",
                        tipo_recurso="legajo",
                        id_recurso=str(legajo.id),
                        id_actor=str(coordinador.id),
                        rol_actor=coordinador.role,
                        detalles={
                            "accion": "GRADUAR",
                            "estado_anterior": "Activo",
                            "estado_nuevo": "Graduado",
                        },
                        creado_en=fecha_graduacion,
                    )
                )

        legajos_por_clave[item["clave"]] = legajo

    return legajos_por_clave


def _obtener_o_crear_seminario(
    session: Session,
    *,
    cohorte_id: Any,
    nombre: str,
    docente_nombre: str,
    docente_email: str,
    fecha_fin_cuatrimestre: date,
    carrera: str,
    es_obligatorio: bool,
    fecha_limite_notas: datetime | None = None,
) -> Seminario:
    seminario = session.scalar(
        select(Seminario).where(
            Seminario.cohorte_id == cohorte_id,
            Seminario.nombre == nombre,
        )
    )
    if seminario is None:
        seminario = Seminario(
            cohorte_id=cohorte_id,
            nombre=nombre,
            docente_nombre=docente_nombre,
            docente_email=docente_email,
            fecha_fin_cuatrimestre=fecha_fin_cuatrimestre,
            carrera=carrera,
            es_obligatorio=es_obligatorio,
            fecha_limite_notas=fecha_limite_notas,
        )
        session.add(seminario)
        session.flush()
    return seminario


def _asegurar_clases_y_cursada(
    session: Session,
    *,
    seminario: Seminario,
    fechas_clases: list[date],
    legajo: Legajo,
    cantidad_presentes: int,
    nota: Decimal | None,
    momento_nota: datetime | None,
) -> None:
    clases: list[ClaseSeminario] = []
    for fecha_clase in fechas_clases:
        clase = session.scalar(
            select(ClaseSeminario).where(
                ClaseSeminario.seminario_id == seminario.id,
                ClaseSeminario.fecha == fecha_clase,
            )
        )
        if clase is None:
            clase = ClaseSeminario(seminario_id=seminario.id, fecha=fecha_clase)
            session.add(clase)
            session.flush()
        clases.append(clase)

    inscripcion = session.scalar(
        select(InscripcionSeminario).where(
            InscripcionSeminario.seminario_id == seminario.id,
            InscripcionSeminario.legajo_id == legajo.id,
        )
    )
    if inscripcion is None:
        inscripcion = InscripcionSeminario(
            seminario_id=seminario.id,
            legajo_id=legajo.id,
            nota=nota,
            ultimo_avance_en=momento_nota,
        )
        session.add(inscripcion)
        session.flush()

    for idx, clase in enumerate(clases):
        asistencia = session.scalar(
            select(AsistenciaSeminario).where(
                AsistenciaSeminario.clase_id == clase.id,
                AsistenciaSeminario.inscripcion_id == inscripcion.id,
            )
        )
        if asistencia is None:
            session.add(
                AsistenciaSeminario(
                    clase_id=clase.id,
                    inscripcion_id=inscripcion.id,
                    presente=idx < cantidad_presentes,
                )
            )


def _seed_planes_y_carga_academica(
    session: Session,
    *,
    cohortes: dict[int, Cohorte],
    legajos: dict[str, Legajo],
    coordinador: User,
    hoy: date,
    ahora: datetime,
) -> None:
    # Asignar coordinador a las tres carreras para recepción de alertas
    for carrera in ("Especialización", "Maestría", "Doctorado"):
        asig = session.scalar(
            select(AsignacionCoordinador).where(
                AsignacionCoordinador.carrera == carrera,
                AsignacionCoordinador.usuario_id == coordinador.id,
            )
        )
        if asig is None:
            session.add(AsignacionCoordinador(carrera=carrera, usuario_id=coordinador.id))

    # Confirmar planes de graduación en las cohortes 2024, 2025 y 2026
    for anio in (2024, 2025, 2026):
        cohorte = cohortes[anio]
        for carrera in ("Especialización", "Maestría", "Doctorado"):
            plan = session.scalar(
                select(PlanGraduacion).where(
                    PlanGraduacion.cohorte_id == cohorte.id,
                    PlanGraduacion.carrera == carrera,
                )
            )
            if plan is None:
                session.add(
                    PlanGraduacion(
                        cohorte_id=cohorte.id,
                        carrera=carrera,
                        confirmado=True,
                        requiere_recalculo=True,
                    )
                )

    # ── Seminarios Cohorte 2026 ──
    c2026 = cohortes[2026]
    sem_2026_esp_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2026.id,
        nombre="Arquitectura de Software Avanzada",
        docente_nombre="Dr. Ing. Gustavo Rossi",
        docente_email="grossi@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=hoy + timedelta(days=30),
        carrera="Especialización",
        es_obligatorio=True,
        fecha_limite_notas=ahora + timedelta(days=15),
    )
    sem_2026_esp_2 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2026.id,
        nombre="Calidad y Testing de Sistemas Críticos",
        docente_nombre="Mg. Ing. Laura Martínez",
        docente_email="lmartinez@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=hoy + timedelta(days=45),
        carrera="Especialización",
        es_obligatorio=False,
        fecha_limite_notas=ahora + timedelta(days=20),
    )
    sem_2026_mae_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2026.id,
        nombre="Metodología de la Investigación Científica",
        docente_nombre="Dra. Ana Clara Morales",
        docente_email="amorales@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=hoy + timedelta(days=30),
        carrera="Maestría",
        es_obligatorio=True,
        fecha_limite_notas=ahora + timedelta(days=10),
    )
    sem_2026_doc_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2026.id,
        nombre="Epistemología e Investigación Tecnológica",
        docente_nombre="Dr. Roberto Giordano",
        docente_email="rgiordano@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=hoy + timedelta(days=30),
        carrera="Doctorado",
        es_obligatorio=True,
        fecha_limite_notas=ahora + timedelta(days=12),
    )

    fechas_2026 = [hoy - timedelta(days=28), hoy - timedelta(days=21), hoy - timedelta(days=14), hoy - timedelta(days=7)]
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2026_esp_1,
        fechas_clases=fechas_2026,
        legajo=legajos["2026_activo_esp"],
        cantidad_presentes=4,
        nota=Decimal("9.0"),
        momento_nota=ahora - timedelta(days=3),
    )
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2026_esp_2,
        fechas_clases=fechas_2026,
        legajo=legajos["2026_activo_esp"],
        cantidad_presentes=3,
        nota=None,  # Pendiente de carga de nota por el docente
        momento_nota=None,
    )
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2026_mae_1,
        fechas_clases=fechas_2026,
        legajo=legajos["2026_activo_mae"],
        cantidad_presentes=4,
        nota=Decimal("8.5"),
        momento_nota=ahora - timedelta(days=5),
    )
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2026_doc_1,
        fechas_clases=fechas_2026,
        legajo=legajos["2026_activo_doc"],
        cantidad_presentes=4,
        nota=Decimal("9.5"),
        momento_nota=ahora - timedelta(days=4),
    )

    # ── Seminarios Cohorte 2025 ──
    c2025 = cohortes[2025]
    sem_2025_esp_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2025.id,
        nombre="Ingeniería de Requerimientos y Modelado",
        docente_nombre="Dr. Ing. Gustavo Rossi",
        docente_email="grossi@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2025, 7, 15),
        carrera="Especialización",
        es_obligatorio=True,
    )
    sem_2025_esp_2 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2025.id,
        nombre="Seguridad en Aplicaciones Web y Cloud",
        docente_nombre="Mg. Ing. Carlos Ferreyra",
        docente_email="cferreyra@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2025, 11, 20),
        carrera="Especialización",
        es_obligatorio=True,
    )
    sem_2025_mae_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2025.id,
        nombre="Diseño de Experimentos y Estadística Aplicada",
        docente_nombre="Dra. Ana Clara Morales",
        docente_email="amorales@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2025, 7, 15),
        carrera="Maestría",
        es_obligatorio=True,
    )
    sem_2025_doc_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2025.id,
        nombre="Seminario Avanzado de Tesis Doctoral I",
        docente_nombre="Dr. Roberto Giordano",
        docente_email="rgiordano@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2025, 11, 20),
        carrera="Doctorado",
        es_obligatorio=True,
    )

    fechas_2025 = [date(2025, 5, 5), date(2025, 5, 12), date(2025, 5, 19), date(2025, 5, 26)]
    # 2025_rojo_esp: aprobó solo 1 de los 2 seminarios obligatorios -> adeuda 1 y superó 75% del plazo (ROJO)
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2025_esp_1,
        fechas_clases=fechas_2025,
        legajo=legajos["2025_rojo_esp"],
        cantidad_presentes=4,
        nota=Decimal("7.5"),
        momento_nota=ahora - timedelta(days=300),
    )
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2025_esp_2,
        fechas_clases=fechas_2025,
        legajo=legajos["2025_rojo_esp"],
        cantidad_presentes=2,  # 50% asistencia -> Libre (no aprobado)
        nota=Decimal("4.0"),
        momento_nota=ahora - timedelta(days=250),
    )
    # 2025_amarillo_esp: aprobó ambos seminarios obligatorios pero no tiene TFI -> AMARILLO
    for sem_esp in (sem_2025_esp_1, sem_2025_esp_2):
        _asegurar_clases_y_cursada(
            session,
            seminario=sem_esp,
            fechas_clases=fechas_2025,
            legajo=legajos["2025_amarillo_esp"],
            cantidad_presentes=4,
            nota=Decimal("8.0"),
            momento_nota=ahora - timedelta(days=120),
        )
        _asegurar_clases_y_cursada(
            session,
            seminario=sem_esp,
            fechas_clases=fechas_2025,
            legajo=legajos["2025_graduado_esp"],
            cantidad_presentes=4,
            nota=Decimal("9.0"),
            momento_nota=ahora - timedelta(days=200),
        )

    # 2025_amarillo_mae y 2025_verde_mae: aprobaron el seminario obligatorio de Maestría
    for clave_mae in ("2025_amarillo_mae", "2025_verde_mae"):
        _asegurar_clases_y_cursada(
            session,
            seminario=sem_2025_mae_1,
            fechas_clases=fechas_2025,
            legajo=legajos[clave_mae],
            cantidad_presentes=4,
            nota=Decimal("8.5"),
            momento_nota=ahora - timedelta(days=90),
        )

    # ── Seminarios Cohorte 2024 ──
    c2024 = cohortes[2024]
    sem_2024_esp_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2024.id,
        nombre="Arquitectura de Microservicios y Sistemas Distribuidos",
        docente_nombre="Dr. Ing. Gustavo Rossi",
        docente_email="grossi@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2024, 7, 12),
        carrera="Especialización",
        es_obligatorio=True,
    )
    sem_2024_mae_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2024.id,
        nombre="Modelado Matemático y Simulación Computacional",
        docente_nombre="Dra. Ana Clara Morales",
        docente_email="amorales@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2024, 7, 12),
        carrera="Maestría",
        es_obligatorio=True,
    )
    sem_2024_mae_2 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2024.id,
        nombre="Gestión de Proyectos de I+D+i",
        docente_nombre="Mg. Ing. Carlos Ferreyra",
        docente_email="cferreyra@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2024, 11, 22),
        carrera="Maestría",
        es_obligatorio=True,
    )
    sem_2024_doc_1 = _obtener_o_crear_seminario(
        session,
        cohorte_id=c2024.id,
        nombre="Tópicos Avanzados de Investigación en Ingeniería",
        docente_nombre="Dr. Roberto Giordano",
        docente_email="rgiordano@frlp.utn.edu.ar",
        fecha_fin_cuatrimestre=date(2024, 11, 22),
        carrera="Doctorado",
        es_obligatorio=True,
    )

    fechas_2024 = [date(2024, 5, 6), date(2024, 5, 13), date(2024, 5, 20), date(2024, 5, 27)]
    # 2024_rojo_mae: aprobó solo 1 de 2 seminarios obligatorios y superó 80% de 1095d -> ROJO
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2024_mae_1,
        fechas_clases=fechas_2024,
        legajo=legajos["2024_rojo_mae"],
        cantidad_presentes=4,
        nota=Decimal("7.0"),
        momento_nota=ahora - timedelta(days=500),
    )
    # 2024_graduado_mae: aprobó ambos seminarios obligatorios
    for sem_mae_24 in (sem_2024_mae_1, sem_2024_mae_2):
        _asegurar_clases_y_cursada(
            session,
            seminario=sem_mae_24,
            fechas_clases=fechas_2024,
            legajo=legajos["2024_graduado_mae"],
            cantidad_presentes=4,
            nota=Decimal("9.5"),
            momento_nota=ahora - timedelta(days=400),
        )
    # 2024_graduado_esp: aprobó seminario obligatorio
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2024_esp_1,
        fechas_clases=fechas_2024,
        legajo=legajos["2024_graduado_esp"],
        cantidad_presentes=4,
        nota=Decimal("10.0"),
        momento_nota=ahora - timedelta(days=450),
    )
    # 2024_rojo_doc: aprobó seminario pero no tiene trabajo final aprobado por CPR y superó 70% de 1825d -> ROJO
    _asegurar_clases_y_cursada(
        session,
        seminario=sem_2024_doc_1,
        fechas_clases=fechas_2024,
        legajo=legajos["2024_rojo_doc"],
        cantidad_presentes=4,
        nota=Decimal("8.0"),
        momento_nota=ahora - timedelta(days=600),
    )


def _seed_trabajos_finales_y_avances(
    session: Session,
    *,
    legajos: dict[str, Legajo],
    hoy: date,
) -> None:
    trabajos_spec = [
        {
            "legajo": legajos["2026_activo_mae"],
            "tipo": "Maestría",
            "titulo": "Optimización Predictiva de Mantenimiento Industrial mediante Aprendizaje Federado",
            "director_nombre": "Dr. Ing. Alejandro Fernández",
            "director_email": "afernandez@frlp.utn.edu.ar",
            "codirector": "Mg. Ing. Patricia Sosa",
            "fecha_aprobacion_cpr": hoy - timedelta(days=60),
            "numero_resolucion": "RES-CPR-042/2026",
        },
        {
            "legajo": legajos["2026_activo_doc"],
            "tipo": "Doctorado",
            "titulo": "Arquitecturas Embebidas de Baja Latencia para Procesamiento de Señales Biomédicas",
            "director_nombre": "Dr. Roberto Giordano",
            "director_email": "rgiordano@frlp.utn.edu.ar",
            "codirector": None,
            "fecha_aprobacion_cpr": hoy - timedelta(days=90),
            "numero_resolucion": "RES-CPR-019/2026",
        },
        {
            "legajo": legajos["2025_verde_mae"],
            "tipo": "Maestría",
            "titulo": "Detección Temprana de Anomalías en Redes Eléctricas Inteligentes con Series Temporales",
            "director_nombre": "Dra. Ana Clara Morales",
            "director_email": "amorales@frlp.utn.edu.ar",
            "codirector": "Dr. Ing. Gustavo Rossi",
            "fecha_aprobacion_cpr": hoy - timedelta(days=240),
            "numero_resolucion": "RES-CPR-118/2025",
        },
        {
            "legajo": legajos["2025_graduado_esp"],
            "tipo": "TFI",
            "titulo": "Auditoría Estructural Automatizada y Gestión Digital de Obras Viales en la Provincia de Buenos Aires",
            "director_nombre": "Mg. Ing. Carlos Ferreyra",
            "director_email": "cferreyra@frlp.utn.edu.ar",
            "codirector": None,
            "fecha_aprobacion_cpr": hoy - timedelta(days=320),
            "numero_resolucion": "RES-CPR-084/2025",
        },
        {
            "legajo": legajos["2024_graduado_mae"],
            "tipo": "Maestría",
            "titulo": "Control Robusto Adaptativo para Sistemas Mecatrónicos de Alta Precisión",
            "director_nombre": "Dr. Roberto Giordano",
            "director_email": "rgiordano@frlp.utn.edu.ar",
            "codirector": "Dra. Valeria Lucero",
            "fecha_aprobacion_cpr": hoy - timedelta(days=520),
            "numero_resolucion": "RES-CPR-051/2024",
        },
        {
            "legajo": legajos["2024_graduado_esp"],
            "tipo": "TFI",
            "titulo": "Rediseño del Sistema de Trazabilidad Logística Hospitalaria Basado en Estándares GS1",
            "director_nombre": "Mg. Ing. Laura Martínez",
            "director_email": "lmartinez@frlp.utn.edu.ar",
            "codirector": None,
            "fecha_aprobacion_cpr": hoy - timedelta(days=590),
            "numero_resolucion": "RES-CPR-033/2024",
        },
    ]

    for spec in trabajos_spec:
        legajo = spec["legajo"]
        existente = session.scalar(
            select(TrabajoFinal).where(
                TrabajoFinal.legajo_id == legajo.id,
                TrabajoFinal.numero_resolucion == spec["numero_resolucion"],
            )
        )
        if existente is None:
            session.add(
                TrabajoFinal(
                    legajo_id=legajo.id,
                    tipo=spec["tipo"],
                    titulo=spec["titulo"],
                    director_nombre=spec["director_nombre"],
                    director_email=spec["director_email"],
                    codirector=spec["codirector"],
                    fecha_aprobacion_cpr=spec["fecha_aprobacion_cpr"],
                    numero_resolucion=spec["numero_resolucion"],
                )
            )

    avances_spec = [
        {
            "legajo": legajos["2025_verde_mae"],
            "carrera": "Maestría",
            "fecha": hoy - timedelta(days=120),
            "descripcion": "Entrega y validación del estado del arte y diseño experimental con la directora.",
        },
        {
            "legajo": legajos["2025_verde_mae"],
            "carrera": "Maestría",
            "fecha": hoy - timedelta(days=35),
            "descripcion": "Presentación de resultados preliminares ante la comisión de seguimiento de tesis.",
        },
        {
            "legajo": legajos["2026_activo_doc"],
            "carrera": "Doctorado",
            "fecha": hoy - timedelta(days=25),
            "descripcion": "Aprobación del protocolo de ensayos en laboratorio y primer informe anual de avance.",
        },
        {
            "legajo": legajos["2024_graduado_mae"],
            "carrera": "Maestría",
            "fecha": hoy - timedelta(days=210),
            "descripcion": "Defensa oral de tesis aprobada con mención especial por el jurado evaluador.",
        },
    ]

    for av in avances_spec:
        legajo = av["legajo"]
        existente = session.scalar(
            select(AvanceTesis).where(
                AvanceTesis.legajo_id == legajo.id,
                AvanceTesis.carrera == av["carrera"],
                AvanceTesis.descripcion == av["descripcion"],
            )
        )
        if existente is None:
            session.add(
                AvanceTesis(
                    legajo_id=legajo.id,
                    carrera=av["carrera"],
                    fecha=av["fecha"],
                    descripcion=av["descripcion"],
                )
            )


def main() -> None:
    if settings.environment.lower() != "development":
        raise RuntimeError("El seed de datos de prueba solo puede ejecutarse en development")

    ahora = datetime.now(timezone.utc)
    hoy = ahora.astimezone().date()

    with SessionLocal() as session:
        usuarios = _seed_usuarios(session)
        coordinador = usuarios["admin@fenix.test"]
        cohortes = _seed_cohortes(session, hoy)
        legajos = _seed_legajos(session, cohortes, ahora, coordinador)
        _seed_planes_y_carga_academica(
            session,
            cohortes=cohortes,
            legajos=legajos,
            coordinador=coordinador,
            hoy=hoy,
            ahora=ahora,
        )
        _seed_trabajos_finales_y_avances(
            session,
            legajos=legajos,
            hoy=hoy,
        )
        session.commit()
        recalcular_semaforos(session, ahora=ahora)


if __name__ == "__main__":
    main()
