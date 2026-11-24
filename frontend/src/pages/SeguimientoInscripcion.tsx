import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { extraerErrorApi, guardarBlobComoArchivo } from '../shared/api/useApiClient';
import type { LegajoDetalle, ResultadoSeminarioLegajo } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const TIPOS_DOCUMENTO = [
    { valor: 'FORM_INSCRIPCION', etiqueta: 'Formulario de preinscripción firmado' },
    { valor: 'DNI', etiqueta: 'DNI / Pasaporte' },
    { valor: 'TITULO', etiqueta: 'Copia título de grado' },
    { valor: 'PARTIDA', etiqueta: 'Partida de nacimiento' },
    { valor: 'CUIT', etiqueta: 'Constancia CUIT/CUIL' },
    { valor: 'TITULO_POSGRADO', etiqueta: 'Título de posgrado' },
    { valor: 'FORM_BECA', etiqueta: 'Formulario de beca' },
] as const;

export default function SeguimientoInscripcion() {
    const [searchParams] = useSearchParams();

    const [legajoId, setLegajoId] = useState(() => searchParams.get('id') ?? '');
    const [tokenPropietario, setTokenPropietario] = useState('');
    const [detalle, setDetalle] = useState<LegajoDetalle | null>(null);
    const [seminarios, setSeminarios] = useState<ResultadoSeminarioLegajo[]>([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    // Subida/reemplazo de documento PDF
    const [tipoDocSubir, setTipoDocSubir] = useState<string>('DNI');
    const [archivoSubir, setArchivoSubir] = useState<File | null>(null);
    const [subiendoDoc, setSubiendoDoc] = useState(false);

    // Confirmación de corrección de legajo observado
    const [tokenCorreccion, setTokenCorreccion] = useState('');
    const [enviandoCorreccion, setEnviandoCorreccion] = useState(false);

    useEffect(() => {
        document.title = 'Seguimiento de Inscripción | Sistema de Posgrado';
    }, []);

    const consultarLegajo = useCallback(async (id: string, token: string) => {
        const idLimpio = id.trim();
        const tokenLimpio = token.trim();
        if (!idLimpio || !tokenLimpio) {
            setError('Ingresá tanto el código de seguimiento como el token de acceso recibido por correo.');
            return;
        }
        setCargando(true);
        setError(null);
        try {
            const headers = {
                Authorization: `Bearer ${tokenLimpio}`,
                Accept: 'application/json',
            };
            const [respLegajo, respSeminarios] = await Promise.all([
                fetch(`${API_URL}/legajos/${idLimpio}`, { headers }),
                fetch(`${API_URL}/legajos/${idLimpio}/seminarios`, { headers }),
            ]);
            if (!respLegajo.ok) {
                throw new Error(
                    await extraerErrorApi(
                        respLegajo,
                        'No se pudo consultar el legajo. Verificá el código de seguimiento y el token de propietario.',
                    ),
                );
            }
            const datosLegajo: LegajoDetalle = await respLegajo.json();
            setDetalle(datosLegajo);
            if (datosLegajo.documentos_faltantes.length > 0) {
                setTipoDocSubir(datosLegajo.documentos_faltantes[0]);
            }
            if (respSeminarios.ok) {
                setSeminarios(await respSeminarios.json());
            } else {
                setSeminarios([]);
            }
        } catch (err) {
            setDetalle(null);
            setSeminarios([]);
            setError(err instanceof Error ? err.message : 'No se pudo consultar el legajo.');
        } finally {
            setCargando(false);
        }
    }, []);

    const handleSubmitConsulta = (e: FormEvent) => {
        e.preventDefault();
        setMensaje(null);
        void consultarLegajo(legajoId, tokenPropietario);
    };

    const handleDescargarDocumento = async (docId: string, tipo: string) => {
        setError(null);
        try {
            const resp = await fetch(`${API_URL}/documentos/${docId}/download`, {
                headers: { Authorization: `Bearer ${tokenPropietario.trim()}` },
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo descargar el documento.'));
            }
            const blob = await resp.blob();
            guardarBlobComoArchivo(blob, `${tipo}.pdf`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo descargar el documento.');
        }
    };

    const handleSubirDocumento = async (e: FormEvent) => {
        e.preventDefault();
        if (!detalle || !archivoSubir) {
            setError('Seleccioná un archivo PDF para cargar.');
            return;
        }
        setSubiendoDoc(true);
        setError(null);
        setMensaje(null);
        try {
            const formData = new FormData();
            formData.append('tipo', tipoDocSubir);
            formData.append('archivo', archivoSubir);
            const resp = await fetch(`${API_URL}/legajos/${detalle.id}/documentos`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${tokenPropietario.trim()}` },
                body: formData,
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo cargar el documento PDF.'));
            }
            setMensaje(
                resp.status === 201
                    ? `Documento ${tipoDocSubir} agregado correctamente.`
                    : `Documento ${tipoDocSubir} reemplazado correctamente.`,
            );
            setArchivoSubir(null);
            await consultarLegajo(detalle.id, tokenPropietario);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo cargar el documento PDF.');
        } finally {
            setSubiendoDoc(false);
        }
    };

    const handleEnviarCorreccion = async (e: FormEvent) => {
        e.preventDefault();
        const idDestino = (detalle?.id ?? legajoId).trim();
        if (!idDestino || !tokenCorreccion.trim()) {
            setError('Ingresá el código de seguimiento y el token de corrección de un solo uso.');
            return;
        }
        setEnviandoCorreccion(true);
        setError(null);
        setMensaje(null);
        try {
            const resp = await fetch(`${API_URL}/legajos/${idDestino}/correccion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ token: tokenCorreccion.trim() }),
            });
            if (!resp.ok) {
                throw new Error(
                    await extraerErrorApi(resp, 'El token de corrección es inválido, ya fue utilizado o venció.'),
                );
            }
            setMensaje('Corrección enviada con éxito. Tu legajo volvió al estado Pendiente para revisión.');
            setTokenCorreccion('');
            if (tokenPropietario.trim()) {
                await consultarLegajo(idDestino, tokenPropietario);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo enviar la corrección.');
        } finally {
            setEnviandoCorreccion(false);
        }
    };

    const puedeSubirDocumentos = detalle?.estado === 'Pendiente' || detalle?.estado === 'Observado';

    return (
        <div className="flex flex-col flex-grow bg-white font-sans text-slate-800 p-8">
            <main className="max-w-4xl mx-auto w-full flex-grow space-y-8">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Seguimiento de Inscripción y Legajo</h1>
                    <p className="text-sm text-slate-500">
                        Consultá el estado de tu legajo, descargá o reemplazá documentos PDF y enviá subsanaciones
                    </p>
                </div>

                {error && (
                    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
                        {error}
                    </div>
                )}
                {mensaje && (
                    <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800" role="status">
                        {mensaje}
                    </div>
                )}

                <form
                    onSubmit={handleSubmitConsulta}
                    className="border border-slate-200 bg-slate-50 rounded-lg p-6 space-y-4"
                >
                    <h2 className="font-bold text-sm uppercase text-slate-600">Consultar estado con token de propietario</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="codigo-seguimiento" className="block text-xs font-bold mb-1">
                                Código de seguimiento (UUID del legajo)
                            </label>
                            <input
                                id="codigo-seguimiento"
                                type="text"
                                required
                                value={legajoId}
                                onChange={(e) => setLegajoId(e.target.value)}
                                placeholder="Ej: 550e8400-e29b-41d4-a716-446655440000"
                                className="w-full border border-slate-300 rounded p-2 text-sm bg-white font-mono"
                            />
                        </div>
                        <div>
                            <label htmlFor="token-propietario" className="block text-xs font-bold mb-1">
                                Token privado de propietario (recibido por email)
                            </label>
                            <input
                                id="token-propietario"
                                type="password"
                                required
                                value={tokenPropietario}
                                onChange={(e) => setTokenPropietario(e.target.value)}
                                placeholder="Pegá el token recibido en el correo de confirmación..."
                                className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={cargando}
                            className="bg-[#2a3441] text-white px-5 py-2 rounded text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                        >
                            {cargando ? 'Consultando...' : 'Consultar legajo'}
                        </button>
                    </div>
                </form>

                {detalle && (
                    <section className="border border-slate-200 rounded-lg p-6 space-y-6 shadow-sm">
                        <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-2xl font-bold">
                                    {detalle.apellido}, {detalle.nombre}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    DNI {detalle.dni} · Email: {detalle.email}
                                    {detalle.numero_legajo ? ` · N° Legajo: ${detalle.numero_legajo}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded text-xs font-bold bg-slate-800 text-white">
                                    Estado: {detalle.estado}
                                </span>
                                <span
                                    className={`px-3 py-1 rounded text-xs font-bold ${
                                        detalle.estado_documental === 'VALIDADO'
                                            ? 'bg-green-100 text-green-800'
                                            : detalle.estado_documental === 'COMPLETO'
                                              ? 'bg-blue-100 text-blue-800'
                                              : 'bg-amber-100 text-amber-800'
                                    }`}
                                >
                                    Documentación: {detalle.estado_documental}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-slate-50 p-4 rounded border border-slate-200">
                            <div>
                                <span className="font-semibold">Carreras:</span> {detalle.carreras.join(', ')}
                            </div>
                            <div>
                                <span className="font-semibold">Título de grado:</span> {detalle.titulo_grado}
                            </div>
                            <div>
                                <span className="font-semibold">Solicita beca:</span>{' '}
                                {detalle.solicita_beca ? `Sí (${detalle.tipo_beca ?? ''})` : 'No'}
                            </div>
                            <div>
                                <span className="font-semibold">Fecha de inscripción:</span>{' '}
                                {new Date(detalle.fecha_inscripcion).toLocaleDateString('es-AR')}
                            </div>
                        </div>

                        {detalle.documentos_faltantes.length > 0 && (
                            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                                <strong>Documentos obligatorios pendientes de carga:</strong>{' '}
                                {detalle.documentos_faltantes.join(', ')}
                            </div>
                        )}

                        <div>
                            <h3 className="font-bold text-sm uppercase text-slate-600 mb-2">
                                Documentos presentados ({detalle.documentos.length})
                            </h3>
                            {detalle.documentos.length === 0 ? (
                                <p className="text-sm text-slate-500">No hay documentos registrados.</p>
                            ) : (
                                <ul className="divide-y divide-slate-200 border border-slate-200 rounded">
                                    {detalle.documentos.map((doc) => (
                                        <li key={doc.id} className="p-3 flex justify-between items-center text-sm">
                                            <div>
                                                <span className="font-semibold">{doc.tipo}</span>
                                                <span className="block text-xs text-slate-500">
                                                    Subido: {new Date(doc.fecha_subida).toLocaleDateString('es-AR')}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void handleDescargarDocumento(doc.id, doc.tipo)}
                                                className="border border-slate-300 rounded px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                                            >
                                                Descargar PDF
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {puedeSubirDocumentos && (
                            <form
                                onSubmit={(e) => void handleSubirDocumento(e)}
                                className="border border-slate-200 bg-slate-50 rounded-lg p-4 space-y-3"
                            >
                                <h3 className="font-bold text-sm uppercase text-slate-600">
                                    Agregar o reemplazar documento PDF
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Tipo de documento</label>
                                        <select
                                            value={tipoDocSubir}
                                            onChange={(e) => setTipoDocSubir(e.target.value)}
                                            className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                                        >
                                            {TIPOS_DOCUMENTO.map((t) => (
                                                <option key={t.valor} value={t.valor}>
                                                    {t.etiqueta} ({t.valor})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">Archivo PDF (máx. 5 MB)</label>
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={(e) => setArchivoSubir(e.target.files?.[0] ?? null)}
                                            className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={subiendoDoc || !archivoSubir}
                                        className="bg-[#2a3441] text-white px-4 py-2 rounded text-xs font-semibold hover:bg-slate-700 disabled:opacity-50"
                                    >
                                        {subiendoDoc ? 'Subiendo...' : 'Subir / Reemplazar PDF'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {seminarios.length > 0 && (
                            <div>
                                <h3 className="font-bold text-sm uppercase text-slate-600 mb-2">
                                    Seminarios cursados y calificaciones
                                </h3>
                                <div className="border border-slate-200 rounded overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Seminario</th>
                                                <th className="p-3 border-b border-slate-200 text-center">% Asistencia</th>
                                                <th className="p-3 border-b border-slate-200 text-center">Nota</th>
                                                <th className="p-3 border-b border-slate-200 text-center">Condición</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seminarios.map((s) => (
                                                <tr key={s.seminario_id} className="border-b border-slate-100 last:border-0">
                                                    <td className="p-3 font-medium">{s.nombre}</td>
                                                    <td className="p-3 text-center">{s.porcentaje_asistencia}%</td>
                                                    <td className="p-3 text-center">{s.nota ?? 'Pendiente'}</td>
                                                    <td className="p-3 text-center font-semibold">{s.condicion}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Confirmación de corrección con token de un solo uso (Observado -> Pendiente) */}
                <form
                    onSubmit={(e) => void handleEnviarCorreccion(e)}
                    className="border border-slate-200 bg-slate-50 rounded-lg p-6 space-y-4"
                >
                    <div>
                        <h2 className="font-bold text-sm uppercase text-slate-600">
                            Confirmar corrección de legajo observado (Token de 72 hs)
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Si tu legajo fue observado y recibiste por correo un token de corrección de un solo uso,
                            ingresalo aquí una vez actualizados los documentos para devolver el legajo al estado Pendiente.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[260px]">
                            <label htmlFor="token-correccion" className="block text-xs font-bold mb-1">
                                Token de corrección de un solo uso
                            </label>
                            <input
                                id="token-correccion"
                                type="text"
                                required
                                value={tokenCorreccion}
                                onChange={(e) => setTokenCorreccion(e.target.value)}
                                placeholder="Pegá el token de corrección recibido en el email de observación..."
                                className="w-full border border-slate-300 rounded p-2 text-sm bg-white font-mono"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={enviandoCorreccion || !legajoId.trim() || !tokenCorreccion.trim()}
                            className="border-2 border-slate-800 px-5 py-2 rounded text-sm font-bold hover:bg-white disabled:opacity-50"
                        >
                            {enviandoCorreccion ? 'Enviando...' : 'Confirmar corrección'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}

