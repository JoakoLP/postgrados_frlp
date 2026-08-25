import { useState, useEffect } from 'react';

// Tipos para nuestro mock
type EstadoLegajo = 'Pendiente' | 'En Revisión' | 'Observado' | 'Completado' | 'Activo';

interface Aspirante {
    id: string;
    numero_legajo?: string;
    nombre: string;
    apellido: string;
    dni: string;
    carrera: string;
    cohorte: string;
    beca: boolean;
    estado: EstadoLegajo;
}

// Datos de prueba iniciales
const mockAspirantes: Aspirante[] = [
    { id: '1', nombre: 'María', apellido: 'Gonzalez', dni: '30456789', carrera: 'Maestría', cohorte: '2026', beca: true, estado: 'Pendiente' },
    { id: '2', nombre: 'Lucas', apellido: 'Martínez', dni: '35123456', carrera: 'Especialización', cohorte: '2026', beca: false, estado: 'En Revisión' },
    { id: '3', nombre: 'Sofía', apellido: 'López', dni: '38987654', carrera: 'Doctorado', cohorte: '2025', beca: true, estado: 'Completado', numero_legajo: '25-001-014' },
    { id: '4', nombre: 'Juan', apellido: 'Pérez', dni: '40111222', carrera: 'Maestría', cohorte: '2026', beca: false, estado: 'Observado' },
];

export default function GestionLegajos() {
    useEffect(() => {
        document.title = "Gestión de Legajos | Sistema de Posgrado";
    }, []);

    const [aspirantes, setAspirantes] = useState<Aspirante[]>(mockAspirantes);

    // Estados para los filtros (RF-CORE-004)
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('Todos');
    const [filtroCohorte, setFiltroCohorte] = useState('Todas');
    const [filtroCarrera, setFiltroCarrera] = useState('Todas');
    const [filtroBeca, setFiltroBeca] = useState('Todos');

    // Lógica de filtrado combinada
    const aspirantesFiltrados = aspirantes.filter(asp => {
        const coincideBusqueda = asp.dni.includes(busqueda) || asp.apellido.toLowerCase().includes(busqueda.toLowerCase());
        const coincideEstado = filtroEstado === 'Todos' || asp.estado === filtroEstado;
        const coincideCohorte = filtroCohorte === 'Todas' || asp.cohorte === filtroCohorte;
        const coincideCarrera = filtroCarrera === 'Todas' || asp.carrera === filtroCarrera;
        const coincideBeca = filtroBeca === 'Todos' || (filtroBeca === 'Sí' ? asp.beca : !asp.beca);

        return coincideBusqueda && coincideEstado && coincideCohorte && coincideCarrera && coincideBeca;
    });

    // Lógica de Workflow de Estados (RF-CORE-003)
    const cambiarEstado = (id: string, nuevoEstado: EstadoLegajo) => {
        setAspirantes(prev => prev.map(asp => {
            if (asp.id === id) {
                const actualizado = { ...asp, estado: nuevoEstado };

                // Si se aprueba (pasa a Completado) y no tiene legajo, se genera (RF-CORE-003)
                // A futuro: Se tomarán los datos de la DB y se generará de forma secuencial
                if (nuevoEstado === 'Completado' && !asp.numero_legajo) {
                    const secuencial = Math.floor(Math.random() * 100).toString().padStart(3, '0');
                    const añoStr = asp.cohorte.slice(-2);
                    actualizado.numero_legajo = `${añoStr}-001-${secuencial}`;
                    alert(`¡Legajo generado con éxito para ${asp.nombre} ${asp.apellido}! N°: ${actualizado.numero_legajo}`);
                }

                // Simula envío de email al observar (RF-CORE-003)
                if (nuevoEstado === 'Observado') {
                    alert(`Simulación: Se ha enviado un email automático a ${asp.nombre} indicando que su legajo fue observado.`);
                }

                return actualizado;
            }
            return asp;
        }));
    };

    return (
        <div className="flex flex-col flex-grow bg-white font-sans text-slate-800 p-8">
            <main className="max-w-6xl mx-auto w-full flex-grow flex flex-col">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Gestión de Legajos</h1>
                    <h2 className="text-slate-500">Revisión de aspirantes y generación de matrículas</h2>
                </div>

                {/* Filtros (RF-CORE-004) */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="col-span-1 md:col-span-5 flex justify-between items-end mb-2">
                        <div className="w-full md:w-1/3">
                            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Buscar (DNI o Apellido)</label>
                            <input
                                type="text"
                                placeholder="Ej: 30456789 o Gonzalez"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-slate-500"
                            />
                        </div>
                        <button
                            onClick={() => alert("Simulación: Excel descargado correctamente.")}
                            className="bg-[#2a3441] text-white px-4 py-2 rounded text-sm font-semibold hover:bg-slate-700 transition-colors h-fit"
                        >
                            Exportar Excel
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Estado</label>
                        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white">
                            <option value="Todos">Todos</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="En Revisión">En Revisión</option>
                            <option value="Observado">Observado</option>
                            <option value="Completado">Completado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Cohorte</label>
                        <select value={filtroCohorte} onChange={(e) => setFiltroCohorte(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white">
                            <option value="Todas">Todas</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Carrera</label>
                        <select value={filtroCarrera} onChange={(e) => setFiltroCarrera(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white">
                            <option value="Todas">Todas</option>
                            <option value="Especialización">Especialización</option>
                            <option value="Maestría">Maestría</option>
                            <option value="Doctorado">Doctorado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 text-slate-600 uppercase">Beca</label>
                        <select value={filtroBeca} onChange={(e) => setFiltroBeca(e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm outline-none bg-white">
                            <option value="Todos">Todos</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                </div>

                {/* Tabla de Resultados */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm flex-grow">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-[#2a3441] text-white text-xs uppercase font-bold">
                            <tr>
                                <th className="p-3">Aspirante</th>
                                <th className="p-3">DNI</th>
                                <th className="p-3">Carrera / Cohorte</th>
                                <th className="p-3 text-center">Beca</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {aspirantesFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">No se encontraron legajos con los filtros actuales.</td>
                                </tr>
                            ) : (
                                aspirantesFiltrados.map((asp) => (
                                    <tr key={asp.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3 font-medium">
                                            {asp.apellido}, {asp.nombre}
                                            {asp.numero_legajo && <span className="block text-xs text-slate-500 font-normal">Legajo: {asp.numero_legajo}</span>}
                                        </td>
                                        <td className="p-3">{asp.dni}</td>
                                        <td className="p-3">
                                            {asp.carrera}
                                            <span className="block text-xs text-slate-500">{asp.cohorte}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${asp.beca ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                                                {asp.beca ? 'Sí' : 'No'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold 
                                                ${asp.estado === 'Pendiente' ? 'bg-slate-200 text-slate-700' : ''}
                                                ${asp.estado === 'En Revisión' ? 'bg-blue-100 text-blue-700' : ''}
                                                ${asp.estado === 'Observado' ? 'bg-red-100 text-red-700' : ''}
                                                ${asp.estado === 'Completado' ? 'bg-green-100 text-green-700' : ''}
                                            `}>
                                                {asp.estado}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            {/* Acciones de Workflow */}
                                            <select
                                                className="border border-slate-300 rounded p-1 text-xs outline-none bg-white cursor-pointer"
                                                value={asp.estado}
                                                onChange={(e) => cambiarEstado(asp.id, e.target.value as EstadoLegajo)}
                                            >
                                                <option value="Pendiente" disabled>Pendiente</option>
                                                <option value="En Revisión">Revisar</option>
                                                <option value="Observado">Observar</option>
                                                <option value="Completado">Aprobar</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </main>
        </div>
    );
}