import { useEffect } from 'react';
import { Link } from 'react-router-dom';


export default function GestionDocente() {
    useEffect(() => {
        document.title = "Gestión Docente | Sistema de Posgrado";
    }, []);
    const estudiantes = [
        { id: 1, nombre: "Takara, Joaquin", asistencias: [true, true, true], nota: "6.5" },
        { id: 2, nombre: "Pagani, Franco", asistencias: [true, false, true], nota: "7" },
        { id: 3, nombre: "Veliz, Ruben", asistencias: [true, true, true], nota: "7" },
        { id: 4, nombre: "Esperanza, Frango", asistencias: [true, true, true], nota: "8" },
        { id: 5, nombre: "Goya, Matias", asistencias: [true, true, true], nota: "6" },
    ];

    return (
        // Faltan pulir estilos y funcionalidades.
        <div className="flex flex-col flex-grow bg-white font-sans text-slate-800 p-8">
            <main className="max-w-4xl mx-auto w-full flex-grow">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold mb-2">Gestión Docente</h1>
                    <h2 className="text-xl text-slate-500">Carga de Asistencia y Calificaciones</h2>
                </div>

                <div className="mb-8 w-full md:w-2/3 mx-auto">
                    <label className="block text-sm font-bold mb-2">Seleccione el Seminario</label>
                    <select className="w-full border border-slate-300 rounded p-2 text-slate-600 outline-none focus:border-slate-500 appearance-none bg-white">
                        <option>Gestión de Proyectos de Software</option>
                        <option>Bases de Datos Avanzadas</option>
                    </select>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden mb-12">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600">
                            <tr>
                                <th className="p-4 border-b border-slate-200">Estudiante</th>
                                <th className="p-4 border-b border-slate-200 text-center">12/03</th>
                                <th className="p-4 border-b border-slate-200 text-center">19/03</th>
                                <th className="p-4 border-b border-slate-200 text-center">26/03</th>
                                <th className="p-4 border-b border-slate-200 text-center">Nota Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estudiantes.map((est) => (
                                <tr key={est.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-sm">{est.nombre}</td>

                                    {/* Toggles de asistencia */}
                                    {est.asistencias.map((presente, i) => (
                                        <td key={i} className="p-4 text-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" defaultChecked={presente} className="sr-only peer" />
                                                <div className={`w-10 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${presente ? 'bg-[#2a3441] border-[#2a3441]' : 'bg-slate-200 border-slate-300'} border`}></div>
                                            </label>
                                        </td>
                                    ))}

                                    {/* Nota Final */}
                                    <td className="p-4 text-center">
                                        <input
                                            type="text"
                                            defaultValue={est.nota}
                                            className="w-16 border border-slate-300 rounded p-1 text-center text-sm outline-none focus:border-slate-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between mt-auto">
                    <Link to="/panel" className="px-8 py-2 border-2 border-slate-800 rounded font-bold hover:bg-slate-50 transition-colors">
                        Atras
                    </Link>
                    <button type="button" className="px-8 py-2 border-2 border-slate-800 rounded font-bold hover:bg-slate-50 transition-colors">
                        Exportar
                    </button>
                </div>
            </main>
        </div>
    );
}