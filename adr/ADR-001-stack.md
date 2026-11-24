# ADR-001: Elección del Stack Tecnológico

**Estado:** Aceptado  
**Fecha:** 01/05/2026  
**Autor:** Equipo de Desarrollo — Posgrados UTN FRLP

---

## Contexto

Debemos elegir las tecnologías para implementar el Sistema de Gestión Académica de Posgrado de la UTN FRLP antes de comenzar el desarrollo. La elección debe balancear:
- **Conocimiento previo del equipo** (curva de aprendizaje y velocidad de entrega)
- **Soporte de la cátedra** (las tecnologías sugeridas tienen soporte garantizado)
- **Madurez del ecosistema** (documentación, librerías, comunidad)
- **Adecuación al problema** (API REST con reglas de negocio de workflow académico, generación de reportes Excel, notificaciones SMTP y paneles analíticos)

---

## Opciones Evaluadas

### Backend: Opción A — Node.js + NestJS
**Ventajas:** Fuerte tipado con TypeScript, estructura modular con decoradores, ORM Prisma maduro.  
**Desventajas:** Mayor verbosidad de configuración inicial y boilerplate para un proyecto académico de 30 semanas.

### Backend: Opción B — Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic
**Ventajas:** Sintaxis concisa y expresiva, validación declarativa con Pydantic v2, generación automática de documentación OpenAPI (`/api/docs`), excelente integración con SQLAlchemy 2.0, Alembic y Pytest, y facilidad para procesamiento de datos y reportes en los módulos C y D.  
**Desventajas:** Requiere mantener sincronizados los tipos entre los esquemas Pydantic del backend y las interfaces TypeScript del frontend.

### Frontend: React 19 + TypeScript + Vite + TailwindCSS + Chart.js
**Ventajas:** Ecosistema maduro, compilación instantánea con Vite, diseño consistente con TailwindCSS, formularios validados con `react-hook-form` y gráficos interactivos con `react-chartjs-2`.

---

## Decisión

Decidimos usar **Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL 16** en el backend y **React 19 + TypeScript + Vite + TailwindCSS** en el frontend, orquestados localmente mediante **Docker Compose** (incluyendo **MailHog** para pruebas SMTP).

---

## Consecuencias

### Positivas
- Desarrollo ágil de endpoints REST con validación estricta en Pydantic y cobertura de tests superior al 90% con `pytest` y `TestClient`.
- Migraciones versionadas y reproducibles con Alembic sobre PostgreSQL 16.
- Entorno local unificado que levanta base de datos, migraciones, datos de prueba (`scripts.seed`), servidor SMTP de desarrollo y aplicación web.

### Negativas (trade-offs)
- Al utilizar dos lenguajes distintos (Python en backend y TypeScript en frontend), los contratos de datos deben mantenerse alineados entre `esquemas.py`/`schemas.py` y `frontend/src/types/index.ts`.
