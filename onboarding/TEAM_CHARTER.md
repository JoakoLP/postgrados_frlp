# Team Charter — OptimaSys

**Módulo asignado:** [Core + MOD-B / MOD-C / MOD-D]  
**Fecha:** 17/05/2026 | **Repositorio:** https://github.com/JoakoLP/postgrados_frlp

---

## 1. Misión del Equipo

"Construir el módulo [X] del sistema Fenix Posgrado para UTN FRLP, que reemplaza el proceso actual de Sistema para Posgrado, reduciendo el tiempo de [X] a [Y]. Nuestro sistema lo usará [quién] para [qué]."

---

## 2. Integrantes y Rotación de Roles

| Nombre | Semanas 1-4 | Semanas 5-8 | Semanas 9-12 | Semanas 13-16 |
|--------|:-----------:|:-----------:|:------------:|:--------------:|
| | Product Owner | Tech Lead | Dev Lead | QA/UX |
| | Tech Lead | Dev Lead | QA/UX | Product Owner |
| | Dev Lead | QA/UX | Product Owner | Tech Lead |
| | QA/UX | Product Owner | Tech Lead | Dev Lead |

---

## 3. Acuerdos de Trabajo

**Comunicación:** Grupo de WhatsApp y Discord canal `#[desarrollo-de-software, OptimaSys]` | Respuesta máxima: 24 horas hábiles  
**Daily async:** Daily virtual asíncrono (mensaje de texto en Discord o WhatsApp). · Formato: "✅ Hice | 🔜 Haré | 🚧 Bloqueante"  
**Reunión semanal:** Domingo a las 15:00hs por Discord · Máximo 1 hora  
**Pull Requests:** Necesitan 1 aprobación · Plazo para revisión: 24 horas  
**Conflictos técnicos:** Si no se resuelven en 24hs → consulta al docente (no es rendición)  

---

## 4. Stack Tecnológico (ver ADR-001)

| Capa | Tecnología | Justificación breve |
|------|-----------|---------------------|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS + TanStack Query | Tecnología más demandada, rápida de desarrollar e ideal para ecosistema moderno. Recomendada por el profesor. |
| Backend | FastAPI (Python 3.12+) | Mucho más simple, rápido, y genera documentación automática (Swagger). Recomendada por el profesor. |
| Base de datos | PostgreSQL 15 | Excelente rendimiento y ecosistema. Recomendada por el profesor. |
| ORM | SQLAlchemy 2.0 + Alembic | Estándar maduro y potente para Python con soporte para migraciones. Recomendada por el profesor. |
| Testing | Pytest + HTTPX | Muy simple y potente para garantizar la cobertura requerida de tests unitarios. Recomendada por el profesor. |

---

## 5. Riesgos Identificados

| Riesgo | Prob. | Impacto | Mitigación |
|--------|:-----:|:-------:|-----------|
 Migración de Datos Incompleta/Corrupta | Alta | Alto | Análisis exhaustivo y prueba rigurosa de scripts con datos de muestra. |
| Requisitos Ambiguos o Incompletos | Media | Alto | Uso de User Stories con Criterios de Aceptación (DoD) y validación temprana. |
| Ampliación del Alcance (Scope Creep) | Alta | Alto | Definición clara del MVP y priorización rigurosa bajo método MoSCoW. |
| Rendimiento Inadecuado Bajo Carga | Media | Alto | Diseño de arquitectura escalable, optimización de consultas y caché. |


---

## 6. Firmas

> El commit de este archivo con nombres en el mensaje equivale a la firma digital.

**Commit sugerido:** `docs: team charter firmado por [N1], [N2], [N3], [N4]`

- [ ] [Nombre 1] — Product Owner
- [ ] [Nombre 2] — Tech Lead
- [ ] [Nombre 3] — Dev Lead
- [ ] [Nombre 4] — QA/UX Lead
