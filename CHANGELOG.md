# Changelog — Sistema de Posgrado

Todos los cambios notables de este proyecto se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).  
Este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

---

## [Unreleased]

> Los cambios que están en `develop` / `main` para la entrega actual van acá.

### Added
- **Módulo Core (Inscripción, Legajos, Documentos y Cohortes)**:
  - Modelos y migraciones Alembic para cohortes, legajos, documentos de inscripción, usuarios, sesiones y auditoría.
  - Endpoint público `POST /api/v1/legajos` con validación de datos, unicidad por cohorte, límite de 10 envíos por IP/hora, validación de firma y tamaño de PDFs (máx. 5 MB), almacenamiento privado fuera del webroot con SHA-256 y envío de email de confirmación con token de propietario.
  - Evaluación de estado documental (`INCOMPLETO`, `COMPLETO`, `VALIDADO`), descarga autenticada de PDFs (`GET /api/v1/documentos/{id}/download`) y carga/reemplazo de documentos por el propietario (`POST /api/v1/legajos/{id}/documentos`).
  - Workflow completo de estados de legajo (`REVISAR`, `OBSERVAR`, `APROBAR`, `RECHAZAR`, `MATRICULAR`, `GRADUAR`, `DAR_DE_BAJA`) con generación de número de legajo (`AA-001-NNN`), notificaciones por correo y subsanación con token de un solo uso de 72 hs (`POST /api/v1/legajos/{id}/correccion`).
  - Vencimiento diario de reservas tras 30 días en estado `Completado` (`vencer_reservas`), pasando a `Vencido` y notificando a coordinadores activos.
  - Listado, detalle y búsqueda combinable de legajos (`estado`, `cohorte_id`, `carrera`, `tiene_beca`, `dni`, `apellido`) y exportación XLSX con columna `Fecha de inscripción` y hoja `Metadatos`.
  - Gestión de cohortes (`GET/POST /api/v1/cohortes`, `PATCH /api/v1/cohortes/{id}/inscripcion`, `GET /api/v1/cohortes/proxima-apertura`) en backend y frontend.
- **Módulo B — Gestión Docente (`carga_academica`)**:
  - Alta y listado de seminarios por cohorte, clasificación en el plan de carrera (`carrera`, `es_obligatorio`) y fecha límite de carga de notas.
  - Inscripción por lote de estudiantes activos al seminario y generación de enlaces temporales con token opaco segregado por seminario (`/docente/seminarios/{id}#token={token}`).
  - Gestión de clases, registro de asistencia, cálculo automático de porcentaje de asistencia (excluyendo clases futuras) y condición académica (`Aprobado`, `Desaprobado`, `Libre`, `En curso`).
  - Carga manual e importación por Excel de calificaciones (`1.0` a `10.0`), exportación de planilla docente a Excel con hoja `Metadatos`, y tareas automáticas de recordatorios por notas pendientes (≤ 48 hs) y falta de asistencia (> 14 días).
- **Módulo C — Seguimiento de Graduación (`seguimiento_graduacion`)**:
  - Alta, modificación y consulta de Trabajos Finales / Tesis (`TFI`, `Maestría`, `Doctorado`) y registro de avances de tesis exclusivos para el rol `CPR` con auditoría de intentos denegados y selector de legajos (`GET /api/v1/cpr/legajos`).
  - Confirmación de planes de graduación por cohorte y carrera, y asignación de coordinadores destinatarios de alertas por carrera.
  - Motor de cálculo de semáforo de graduación (`VERDE`, `AMARILLO`, `ROJO`), asignación manual de `VERDE` por coordinación, generación y envío de alertas de riesgo académico, y exportación Excel de estudiantes en riesgo.
- **Módulo D — Analytics & Panel de Conducción**:
  - Endpoint `GET /api/v1/graduacion/estadisticas` y exportación `GET /api/v1/graduacion/estadisticas/exportar` con KPIs globales (`total_inscriptos`, `total_graduados`, `tasa_retencion`, `desgranamiento`, `promedio_tiempo_graduacion_dias`, `estudiantes_en_riesgo`) y desglose por cohorte filtrable por carrera.
- **Frontend (React 19 + TypeScript + Vite + TailwindCSS)**:
  - Formulario público de preinscripción de 3 pasos con guardado de borrador local, aviso de próxima apertura, selector de cohorte y modal de vista previa de PDFs (`/inscripcion`).
  - Portal de seguimiento y subsanación para el aspirante (`/seguimiento`).
  - Portal público de planilla docente (`/docente/seminarios/:id`).
  - Panel de coordinación (`/coordinador/legajos`, `/coordinador/panel`, `/coordinador/gestion-docente`, `/coordinador/graduacion`) y vista de Trabajos Finales CPR (`/cpr/trabajos-finales`).
- **Infraestructura, Seed y CI/CD**:
  - Script `backend/scripts/seed.py` idempotente con datos variados de prueba para todos los módulos (usuarios, cohortes, legajos con PDFs, seminarios, trabajos finales y semáforos).
  - Pipeline de GitHub Actions (`.github/workflows/ci.yml`) configurado para Python 3.12 + PostgreSQL 16 + Alembic + Pytest (cobertura ≥ 70%) y Node.js 22 + ESLint + Vite Build.

### Fixed
- Limpieza de comentarios inline en variables vacías de `.env.example` (`SMTP_USER`, `SMTP_PASSWORD`) y saneamiento en `Settings` para evitar errores de autenticación SMTP con MailHog en Docker.
- Alineación de zona horaria (`UTC-3`) en pruebas de recordatorios de asistencia docente.
- Expiración automática futura al generar enlaces docentes para seminarios de cohortes históricas.

---

## [v0.1.0-alpha] — Sprint 0 (15/05/2026)

### Added
- Autenticación JWT básica (login/refresh/logout) con rotación de refresh tokens
- Modelo de base de datos inicial con migraciones Alembic
- Docker Compose funcional para ambiente de desarrollo (`db`, `backend`, `frontend`, `mailhog`)
- Pipeline de CI/CD base en GitHub Actions
