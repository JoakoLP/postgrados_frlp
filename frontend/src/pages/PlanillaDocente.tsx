import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

import { extraerErrorApi, guardarBlobComoArchivo } from '../shared/api/useApiClient';
import type { PlanillaSeminario } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function extraerTokenDesdeHash(hash: string): string {
    const limpio = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(limpio);
    return (params.get('token') ?? '').trim();
}

export default function PlanillaDocente() {
    const { id: seminarioId = '' } = useParams<{ id: string }>();

    const [tokenInput, setTokenInput] = useState(() => extraerTokenDesdeHash(window.location.hash));
    const [tokenActivo, setTokenActivo] = useState(() => extraerTokenDesdeHash(window.location.hash));
    const [planilla, setPlanilla] = useState<PlanillaSeminario | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    const [nuevaFechaClase, setNuevaFechaClase] = useState(() => new Date().toISOString().slice(0, 10));
    const [claseEditandoId, setClaseEditandoId] = useState<string | null>(null);
    const [fechaClaseEditada, setFechaClaseEditada] = useState('');
    const [notasEditadas, setNotasEditadas] = useState<Record<string, string>>({});

    useEffect(() => {
        document.title = 'Planilla Docente | Sistema de Posgrado';
    }, []);

    useEffect(() => {
        const manejarCambioHash = () => {
            const extraido = extraerTokenDesdeHash(window.location.hash);
            if (extraido) {
                setTokenInput(extraido);
                setTokenActivo(extraido);
            }
        };
        window.addEventListener('hashchange', manejarCambioHash);
        return () => window.removeEventListener('hashchange', manejarCambioHash);
    }, []);

    const cargarPlanilla = useCallback(async (idSem: string, token: string) => {
        if (!idSem || !token) return;
        setCargando(true);
        setError(null);
        try {
            const resp = await fetch(`${API_URL}/seminarios/${idSem}/estudiantes`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });
            if (!resp.ok) {
                throw new Error(
                    await extraerErrorApi(
                        resp,
                        'El enlace de acceso docente es inválido, venció o no corresponde a este seminario.',
                    ),
                );
            }
            const datos: PlanillaSeminario = await resp.json();
            setPlanilla(datos);
            const iniciales: Record<string, string> = {};
            for (const est of datos.estudiantes) {
                iniciales[est.legajo_id] = est.nota ?? '';
            }
            setNotasEditadas(iniciales);
        } catch (err) {
            setPlanilla(null);
            setError(err instanceof Error ? err.message : 'No se pudo cargar la planilla docente.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        if (!seminarioId || !tokenActivo) return;
        let cancelado = false;
        const ejecutar = async () => {
            try {
                const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/estudiantes`, {
                    headers: {
                        Authorization: `Bearer ${tokenActivo}`,
                        Accept: 'application/json',
                    },
                });
                if (!resp.ok) {
                    throw new Error(
                        await extraerErrorApi(
                            resp,
                            'El enlace de acceso docente es inválido, venció o no corresponde a este seminario.',
                        ),
                    );
                }
                const datos: PlanillaSeminario = await resp.json();
                if (cancelado) return;
                setPlanilla(datos);
                setError(null);
                const iniciales: Record<string, string> = {};
                for (const est of datos.estudiantes) {
                    iniciales[est.legajo_id] = est.nota ?? '';
                }
                setNotasEditadas(iniciales);
            } catch (err) {
                if (!cancelado) {
                    setPlanilla(null);
                    setError(err instanceof Error ? err.message : 'No se pudo cargar la planilla docente.');
                }
            } finally {
                if (!cancelado) {
                    setCargando(false);
                }
            }
        };
        void ejecutar();
        return () => {
            cancelado = true;
        };
    }, [seminarioId, tokenActivo]);

    const handleValidarTokenManual = (e: FormEvent) => {
        e.preventDefault();
        const limpio = tokenInput.trim();
        if (!limpio) {
            setError('Ingresá el token de acceso docente.');
            return;
        }
        window.location.hash = `token=${encodeURIComponent(limpio)}`;
        setTokenActivo(limpio);
    };

    const handleCrearClase = async () => {
        if (!seminarioId || !tokenActivo) return;
        setError(null);
        setMensaje(null);
        try {
            const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/clases`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tokenActivo}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ fecha: nuevaFechaClase }),
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo registrar la clase.'));
            }
            setMensaje(`Clase del ${nuevaFechaClase} registrada.`);
            await cargarPlanilla(seminarioId, tokenActivo);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo registrar la clase.');
        }
    };

    const handleGuardarFechaClase = async (claseId: string) => {
        if (!seminarioId || !tokenActivo || !fechaClaseEditada) return;
        setError(null);
        setMensaje(null);
        try {
            const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/clases/${claseId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${tokenActivo}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ fecha: fechaClaseEditada }),
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo modificar la fecha de la clase.'));
            }
            setClaseEditandoId(null);
            setMensaje('Fecha de clase actualizada.');
            await cargarPlanilla(seminarioId, tokenActivo);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo modificar la fecha de la clase.');
        }
    };

    const handleToggleAsistencia = async (claseId: string, legajoId: string, presente: boolean) => {
        if (!seminarioId || !tokenActivo) return;
        setError(null);
        try {
            const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/asistencias`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${tokenActivo}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    asistencias: [{ clase_id: claseId, legajo_id: legajoId, presente }],
                }),
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo guardar la asistencia.'));
            }
            const actualizada: PlanillaSeminario = await resp.json();
            setPlanilla(actualizada);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar la asistencia.');
        }
    };

    const handleGuardarNota = async (legajoId: string) => {
        if (!seminarioId || !tokenActivo) return;
        const valor = (notasEditadas[legajoId] ?? '').trim();
        const numero = Number(valor);
        if (!valor || Number.isNaN(numero)) {
            setError('Ingresá una nota numérica entre 1 y 10 (hasta 1 decimal).');
            return;
        }
        setError(null);
        setMensaje(null);
        try {
            const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/notas`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${tokenActivo}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ notas: [{ legajo_id: legajoId, nota: numero }] }),
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo guardar la calificación.'));
            }
            const actualizada: PlanillaSeminario = await resp.json();
            setPlanilla(actualizada);
            setMensaje('Calificación guardada correctamente.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar la calificación.');
        }
    };

    const handleImportarNotasExcel = async (archivo: File | undefined) => {
        if (!archivo || !seminarioId || !tokenActivo) return;
        setError(null);
        setMensaje(null);
        try {
            const formData = new FormData();
            formData.append('archivo', archivo);
            const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/importar-notas`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${tokenActivo}` },
                body: formData,
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudieron importar las notas desde Excel.'));
            }
            const actualizada: PlanillaSeminario = await resp.json();
            setPlanilla(actualizada);
            const sincronizadas: Record<string, string> = {};
            for (const est of actualizada.estudiantes) {
                sincronizadas[est.legajo_id] = est.nota ?? '';
            }
            setNotasEditadas(sincronizadas);
            setMensaje('Notas importadas desde Excel correctamente.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudieron importar las notas.');
        }
    };

    const handleExportar = async () => {
        if (!seminarioId || !tokenActivo) return;
        setError(null);
        try {
            const resp = await fetch(`${API_URL}/seminarios/${seminarioId}/exportar`, {
                headers: { Authorization: `Bearer ${tokenActivo}` },
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo exportar la planilla.'));
            }
            const blob = await resp.blob();
            guardarBlobComoArchivo(blob, `seminario-${seminarioId}.xlsx`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo exportar la planilla.');
        }
    };

    return (
        <div className="flex flex-col flex-grow bg-white font-sans text-slate-800 p-8">
            <main className="max-w-6xl mx-auto w-full flex-grow space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Portal Docente · Planilla de Seminario</h1>
                    <p className="text-sm text-slate-500">
                        Acceso exclusivo mediante enlace temporal por seminario (BR-007)
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

                {!planilla && (
                    <form
                        onSubmit={handleValidarTokenManual}
                        className="border border-slate-200 bg-slate-50 rounded-lg p-5 space-y-3"
                    >
                        <label htmlFor="token-docente" className="block text-xs font-bold uppercase text-slate-600">
                            Token de acceso del seminario
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <input
                                id="token-docente"
                                type="password"
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                placeholder="Pegá el token del enlace recibido por correo..."
                                className="flex-1 min-w-[260px] border border-slate-300 rounded p-2 text-sm bg-white"
                            />
                            <button
                                type="submit"
                                disabled={cargando}
                                className="bg-[#2a3441] text-white px-5 py-2 rounded text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                            >
                                {cargando ? 'Verificando...' : 'Abrir planilla'}
                            </button>
                        </div>
                    </form>
                )}

                {planilla && (
                    <>
                        <section className="border border-slate-200 rounded-lg p-5 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold">{planilla.seminario.nombre}</h2>
                                <p className="text-sm text-slate-600">
                                    Docente: <strong>{planilla.seminario.docente_nombre}</strong> ({planilla.seminario.docente_email})
                                    {planilla.seminario.carrera ? ` · Carrera: ${planilla.seminario.carrera}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Fin de cuatrimestre: {planilla.seminario.fecha_fin_cuatrimestre}
                                    {planilla.seminario.fecha_limite_notas
                                        ? ` · Fecha límite de notas: ${new Date(planilla.seminario.fecha_limite_notas).toLocaleString('es-AR')}`
                                        : ''}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="date"
                                    value={nuevaFechaClase}
                                    onChange={(e) => setNuevaFechaClase(e.target.value)}
                                    className="border border-slate-300 rounded p-1.5 text-xs bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleCrearClase()}
                                    className="border border-slate-800 rounded px-3 py-1.5 text-xs font-bold hover:bg-white"
                                >
                                    + Registrar clase
                                </button>
                                <label className="border border-slate-800 rounded px-3 py-1.5 text-xs font-bold hover:bg-white cursor-pointer">
                                    Importar notas (.xlsx)
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        className="hidden"
                                        onChange={(e) => void handleImportarNotasExcel(e.target.files?.[0])}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => void handleExportar()}
                                    className="bg-[#2a3441] text-white rounded px-3 py-1.5 text-xs font-bold hover:bg-slate-700"
                                >
                                    Exportar Excel
                                </button>
                            </div>
                        </section>

                        <section className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#2a3441] text-white text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-3">Estudiante</th>
                                        {planilla.clases.map((clase) => (
                                            <th key={clase.id} className="p-3 text-center">
                                                {claseEditandoId === clase.id ? (
                                                    <div className="inline-flex items-center gap-1">
                                                        <input
                                                            type="date"
                                                            value={fechaClaseEditada}
                                                            onChange={(e) => setFechaClaseEditada(e.target.value)}
                                                            className="border border-slate-300 rounded p-0.5 text-xs text-slate-800 bg-white"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleGuardarFechaClase(clase.id)}
                                                            className="bg-white text-slate-800 rounded px-1.5 py-0.5 text-[10px] font-bold"
                                                        >
                                                            OK
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        title="Click para editar fecha de clase"
                                                        onClick={() => {
                                                            setClaseEditandoId(clase.id);
                                                            setFechaClaseEditada(clase.fecha);
                                                        }}
                                                        className="hover:underline"
                                                    >
                                                        {clase.fecha}
                                                    </button>
                                                )}
                                            </th>
                                        ))}
                                        <th className="p-3 text-center">% Asist.</th>
                                        <th className="p-3 text-center">Nota Final (1-10)</th>
                                        <th className="p-3 text-center">Condición</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {planilla.estudiantes.length === 0 ? (
                                        <tr>
                                            <td colSpan={planilla.clases.length + 4} className="p-6 text-center text-slate-500">
                                                No hay estudiantes inscriptos en este seminario.
                                            </td>
                                        </tr>
                                    ) : (
                                        planilla.estudiantes.map((est) => (
                                            <tr key={est.legajo_id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="p-3 font-medium">
                                                    {est.apellido}, {est.nombre}
                                                    <span className="block text-xs text-slate-500">
                                                        {est.email} {est.numero_legajo ? `· Legajo ${est.numero_legajo}` : ''}
                                                    </span>
                                                </td>
                                                {est.asistencias.map((celda) => (
                                                    <td key={celda.clase_id} className="p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={celda.presente}
                                                            onChange={(e) =>
                                                                void handleToggleAsistencia(
                                                                    celda.clase_id,
                                                                    est.legajo_id,
                                                                    e.target.checked,
                                                                )
                                                            }
                                                            className="h-4 w-4 cursor-pointer accent-[#2a3441]"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-3 text-center font-semibold">{est.porcentaje_asistencia}%</td>
                                                <td className="p-3 text-center">
                                                    <div className="inline-flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            value={notasEditadas[est.legajo_id] ?? ''}
                                                            onChange={(e) =>
                                                                setNotasEditadas((prev) => ({
                                                                    ...prev,
                                                                    [est.legajo_id]: e.target.value,
                                                                }))
                                                            }
                                                            className="w-16 border border-slate-300 rounded p-1 text-center text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleGuardarNota(est.legajo_id)}
                                                            className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold hover:bg-slate-100"
                                                        >
                                                            Guardar
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span
                                                        className={`px-2 py-1 rounded text-xs font-bold ${
                                                            est.condicion === 'Aprobado'
                                                                ? 'bg-green-100 text-green-700'
                                                                : est.condicion === 'Desaprobado' || est.condicion === 'Libre'
                                                                  ? 'bg-red-100 text-red-700'
                                                                  : 'bg-slate-100 text-slate-700'
                                                        }`}
                                                    >
                                                        {est.condicion}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
