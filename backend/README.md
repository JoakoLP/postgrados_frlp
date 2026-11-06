# Backend

API REST de inscripción implementada con FastAPI, SQLAlchemy y PostgreSQL.

## Desarrollo local

Desde la carpeta `backend`:

```powershell
python -m pip install -e ".[dev]"
$env:DATABASE_URL = "postgresql+psycopg2://postgrado_user:cambiar_en_produccion@localhost:5432/postgrado_dev"
alembic upgrade head
backend
```

El comando `backend` inicia la aplicación desde `main.py` y activa la recarga
automática cuando `ENVIRONMENT=development`. Para iniciar Uvicorn manualmente,
ejecutar `uvicorn main:app --reload` desde la carpeta `backend`.

La migración inicial crea las tablas de cohortes, legajos y documentos, y abre la
cohorte 2026 para desarrollo. En Docker, `STORAGE_PATH` configura el directorio
privado de archivos y `MAX_FILE_SIZE_MB` el tamaño máximo por PDF (5 MB por
defecto). Los archivos no se exponen como recursos estáticos.

La documentación interactiva de la API queda disponible en
`http://localhost:8000/api/docs`; el chequeo de disponibilidad está en
`/health`.

## Inscripción pública

`POST /api/v1/inscripciones` recibe `multipart/form-data` y no requiere
autenticación. `carreras` se envía como una lista JSON; el resto de los campos
coincide con los nombres del formulario web. Los cinco documentos obligatorios
son `archivo_preinscripcion`, `archivo_dni`, `archivo_titulo`,
`archivo_partida` y `archivo_cuit`. `archivo_posgrado` es obligatorio si se
informa `titulo_posgrado`; `archivo_beca` si se solicita beca.

Se aceptan PDFs de hasta el límite configurado y se comprueba tanto el MIME
declarado como la firma del contenido. Una respuesta `201` contiene el código
de seguimiento y el estado inicial `Pendiente`; se devuelve `409` para DNI/email
duplicados o si no hay cohorte abierta.