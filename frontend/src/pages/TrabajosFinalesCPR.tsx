import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { extraerErrorApi, useApiClient } from '../shared/api/useApiClient';
import type { LegajoResumenCPR, TipoCarrera, TipoTrabajoFinal, TrabajoFinal } from '../types';

interface AvanceTesis {
    id: string;
    legajo_id: string;
    carrera: TipoCarrera;
    fecha: string;
    descripcion: string;
}

export default function TrabajosFinalesCPR() {
    const { solicitar } = useApiClient();

    const [legajosDisponibles, setLegajosDisponibles] = useState<LegajoResumenCPR[]>([]);
    const [legajoId, setLegajoId] = useState('');
    const [dniBusqueda, setDniBusqueda] = useState('');
    const [trabajos, setTrabajos] = useState<TrabajoFinal[]>([]);
    const [avances, setAvances] = useState<AvanceTesis[]>([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    // Formulario de creación / edición de trabajo final
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [tipo, setTipo] = useState<TipoTrabajoFinal>('TFI');
    const [titulo, setTitulo] = useState('');
    const [directorNombre, setDirectorNombre] = useState('');
    const [directorEmail, setDirectorEmail] = useState('');
    const [codirector, setCodirector] = useState('');
    const [fechaAprobacion, setFechaAprobacion] = useState('');
    const [numeroResolucion, setNumeroResolucion] = useState('');

    // Formulario de avance de tesis
    const [avanceCarrera, setAvanceCarrera] = useState<TipoCarrera>('Especialización');
    const [avanceFecha, setAvanceFecha] = useState(() => new Date().toISOString().slice(0, 10));
    const [avanceDescripcion, setAvanceDescripcion] = useState('');

    useEffect(() => {
        document.title = 'Trabajos Finales CPR | Sistema de Posgrado';
        let cancelado = false;
        const cargarLegajos = async () => {
            try {
                const resp = await solicitar('/cpr/legajos');
                if (resp.ok && !cancelado) {
                    const lista: LegajoResumenCPR[] = await resp.json();
                    setLegajosDisponibles(lista);
                }
            } catch {
                // Si falla, el usuario aún puede ingresar el UUID manualmente
            }
        };
        void cargarLegajos();
        return () => {
            cancelado = true;
        };
    }, [solicitar]);

    const buscarTrabajos = useCallback(async (idBuscar: string) => {
        if (!idBuscar.trim()) return;
        setCargando(true);
        setError(null);
        setMensaje(null);
        try {
            const [respTrabajos, respAvances] = await Promise.all([
                solicitar(`/legajos/${idBuscar.trim()}/trabajo-final`),
                solicitar(`/legajos/${idBuscar.trim()}/avances-tesis`),
            ]);
            if (!respTrabajos.ok) {
                throw new Error(await extraerErrorApi(respTrabajos, 'No se pudieron consultar los trabajos finales.'));
            }
            setTrabajos(await respTrabajos.json());
            if (respAvances.ok) {
                setAvances(await respAvances.json());
            } else {
                setAvances([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudieron consultar los trabajos finales.');
            setTrabajos([]);
            setAvances([]);
        } finally {
            setCargando(false);
        }
    }, [solicitar]);

    const limpiarFormulario = () => {
        setEditandoId(null);
        setTipo('TFI');
        setTitulo('');
        setDirectorNombre('');
        setDirectorEmail('');
        setCodirector('');
        setFechaAprobacion('');
        setNumeroResolucion('');
    };

    const handleBuscarPorDni = () => {
        const dniLimpio = dniBusqueda.replace(/[.\s]/g, '').trim();
        if (!dniLimpio) {
            setError('Ingresá el DNI del estudiante.');
            return;
        }
        const encontrado = legajosDisponibles.find((l) => l.dni === dniLimpio);
        if (!encontrado) {
            setLegajoId('');
            setTrabajos([]);
            setError(`No se encontró un estudiante activo o graduado con DNI ${dniLimpio}.`);
            return;
        }
        setLegajoId(encontrado.id);
        void buscarTrabajos(encontrado.id);
    };

    const handleGuardarTrabajo = async (evento: FormEvent) => {
        evento.preventDefault();
        if (!legajoId.trim()) {
            setError('Seleccioná un estudiante o buscalo por DNI.');
            return;
        }
        setError(null);
        setMensaje(null);
        try {
            const payload = {
                tipo,
                titulo,
                director_nombre: directorNombre,
                director_email: directorEmail,
                codirector: codirector.trim() ? codirector.trim() : null,
                fecha_aprobacion_cpr: fechaAprobacion,
                numero_resolucion: numeroResolucion,
            };
            const ruta = editandoId
                ? `/trabajos-finales/${editandoId}`
                : `/legajos/${legajoId.trim()}/trabajo-final`;
            const resp = await solicitar(ruta, {
                method: editandoId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo guardar el trabajo final.'));
            }
            setMensaje(editandoId ? 'Trabajo final actualizado.' : 'Trabajo final registrado.');
            limpiarFormulario();
            await buscarTrabajos(legajoId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar el trabajo final.');
        }
    };

    const handleRegistrarAvance = async (evento: FormEvent) => {
        evento.preventDefault();
        if (!legajoId.trim()) {
            setError('Seleccioná un estudiante o buscalo por DNI.');
            return;
        }
        setError(null);
        setMensaje(null);
        try {
            const resp = await solicitar(`/legajos/${legajoId.trim()}/avances-tesis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carrera: avanceCarrera,
                    fecha: avanceFecha,
                    descripcion: avanceDescripcion,
                }),
            });
            if (!resp.ok) {
                throw new Error(await extraerErrorApi(resp, 'No se pudo registrar el avance de tesis.'));
            }
            setMensaje('Avance de tesis registrado correctamente.');
            setAvanceDescripcion('');
            await buscarTrabajos(legajoId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo registrar el avance de tesis.');
        }
    };

    const cargarParaEditar = (tf: TrabajoFinal) => {
        setEditandoId(tf.id);
        setTipo(tf.tipo);
        setTitulo(tf.titulo);
        setDirectorNombre(tf.director_nombre);
        setDirectorEmail(tf.director_email);
        setCodirector(tf.codirector ?? '');
        setFechaAprobacion(tf.fecha_aprobacion_cpr);
        setNumeroResolucion(tf.numero_resolucion);
    };

    return (
        <main className="mx-auto my-8 w-full max-w-5xl px-4 space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-1">Gestión CPR · Trabajos Finales y Avances</h1>
                <p className="text-slate-500 text-sm">Registro exclusivo de Comisión de Posgrado Regional (BR-004)</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                    <label className="block text-xs font-bold mb-1 uppercase text-slate-600">
                        Seleccionar Estudiante Activo / Graduado
                    </label>
                    <select
                        value={legajosDisponibles.some((l) => l.id === legajoId) ? legajoId : ''}
                        onChange={(e) => {
                            const elegido = e.target.value;
                            setLegajoId(elegido);
                            const encontrado = legajosDisponibles.find((l) => l.id === elegido);
                            setDniBusqueda(encontrado?.dni ?? '');
                            if (elegido) {
                                void buscarTrabajos(elegido);
                            } else {
                                setTrabajos([]);
                            }
                        }}
                        className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                    >
                        <option value="">Seleccioná un estudiante del padrón...</option>
                        {legajosDisponibles.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.apellido}, {l.nombre} — DNI {l.dni} {l.numero_legajo ? `(${l.numero_legajo})` : ''} · {l.carreras.join(', ')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label htmlFor="dni-estudiante-cpr" className="block text-xs font-bold mb-1 uppercase text-slate-600">
                            DNI del Estudiante
                        </label>
                        <input
                            id="dni-estudiante-cpr"
                            type="text"
                            value={dniBusqueda}
                            onChange={(e) => setDniBusqueda(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleBuscarPorDni();
                                }
                            }}
                            placeholder="Ej: 38123456"
                            className="w-full border border-slate-300 rounded p-2 text-sm bg-white font-mono"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={cargando || !dniBusqueda.trim()}
                        onClick={handleBuscarPorDni}
                        className="bg-[#2a3441] text-white px-5 py-2 rounded text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                    >
                        {cargando ? 'Buscando...' : 'Buscar Trabajos'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form onSubmit={(e) => void handleGuardarTrabajo(e)} className="border border-slate-200 rounded-lg p-5 space-y-3">
                    <h2 className="font-bold text-lg">
                        {editandoId ? 'Editar Trabajo Final' : 'Registrar Trabajo Final'}
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1">Tipo</label>
                            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTrabajoFinal)} className="w-full border border-slate-300 rounded p-2 text-sm">
                                <option value="TFI">TFI</option>
                                <option value="Maestría">Maestría</option>
                                <option value="Doctorado">Doctorado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Fecha aprobación CPR</label>
                            <input type="date" required value={fechaAprobacion} onChange={(e) => setFechaAprobacion(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">Título</label>
                        <input type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1">Director/a</label>
                            <input type="text" required value={directorNombre} onChange={(e) => setDirectorNombre(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Email Director/a</label>
                            <input type="email" required value={directorEmail} onChange={(e) => setDirectorEmail(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1">Codirector/a (opcional)</label>
                            <input type="text" value={codirector} onChange={(e) => setCodirector(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">N° Resolución</label>
                            <input type="text" required value={numeroResolucion} onChange={(e) => setNumeroResolucion(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="submit" className="bg-[#2a3441] text-white px-4 py-2 rounded text-sm font-semibold hover:bg-slate-700">
                            {editandoId ? 'Guardar cambios' : 'Registrar Trabajo Final'}
                        </button>
                        {editandoId && (
                            <button type="button" onClick={limpiarFormulario} className="border border-slate-300 px-4 py-2 rounded text-sm font-semibold">
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>

                <form onSubmit={(e) => void handleRegistrarAvance(e)} className="border border-slate-200 rounded-lg p-5 space-y-3 h-fit">
                    <h2 className="font-bold text-lg">Registrar Avance de Tesis</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1">Carrera</label>
                            <select value={avanceCarrera} onChange={(e) => setAvanceCarrera(e.target.value as TipoCarrera)} className="w-full border border-slate-300 rounded p-2 text-sm">
                                <option value="Especialización">Especialización</option>
                                <option value="Maestría">Maestría</option>
                                <option value="Doctorado">Doctorado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Fecha</label>
                            <input type="date" required value={avanceFecha} onChange={(e) => setAvanceFecha(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">Descripción del avance</label>
                        <textarea rows={3} required value={avanceDescripcion} onChange={(e) => setAvanceDescripcion(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                    </div>
                    <button type="submit" className="border-2 border-slate-800 px-4 py-2 rounded text-sm font-bold hover:bg-slate-50">
                        Registrar Avance
                    </button>
                </form>
            </div>

            {trabajos.length > 0 && (
                <section className="space-y-3">
                    <h2 className="font-bold text-lg">Trabajos Finales del Legajo</h2>
                    {trabajos.map((tf) => (
                        <div key={tf.id} className="border border-slate-200 rounded-lg p-4 flex justify-between items-start gap-4">
                            <div className="text-sm space-y-1">
                                <div className="font-bold">{tf.tipo} · {tf.titulo}</div>
                                <div className="text-xs text-slate-600">
                                    Director/a: {tf.director_nombre} ({tf.director_email})
                                    {tf.codirector ? ` · Codirector/a: ${tf.codirector}` : ''}
                                </div>
                                <div className="text-xs text-slate-500">
                                    Resolución: {tf.numero_resolucion} · Aprobación CPR: {tf.fecha_aprobacion_cpr}
                                </div>
                            </div>
                            <button type="button" onClick={() => cargarParaEditar(tf)} className="border border-slate-300 rounded px-3 py-1 text-xs font-semibold hover:bg-slate-100">
                                Editar
                            </button>
                        </div>
                    ))}
                </section>
            )}

            {legajoId && (
                <section className="space-y-3">
                    <h2 className="font-bold text-lg">Avances de Tesis ({avances.length})</h2>
                    {avances.length === 0 ? (
                        <p className="text-sm text-slate-500 border border-slate-200 rounded-lg p-4 bg-slate-50">
                            Este estudiante aún no tiene avances de tesis registrados.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {avances.map((av) => (
                                <div key={av.id} className="border border-slate-200 rounded-lg p-4 text-sm space-y-1">
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="font-bold">{av.carrera}</span>
                                        <span className="text-xs font-mono text-slate-500">{av.fecha}</span>
                                    </div>
                                    <p className="text-slate-700">{av.descripcion}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}

