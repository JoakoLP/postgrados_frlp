import { useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { mockEstadisticas } from '../mocks/estadisticas';

// Registramos los componentes necesarios de Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function PanelConduccion() {
    const [cohorteSeleccionada, setCohorteSeleccionada] = useState("Todas");

    // Obtenemos los datos basados en el filtro de la cohorte
    const datosActuales = mockEstadisticas[cohorteSeleccionada] || mockEstadisticas["Todas"];

    // Configuración de los datos para Chart.js
    const chartData = {
        labels: datosActuales.evolucionInscripciones.labels,
        datasets: [
            {
                label: 'Inscriptos',
                data: datosActuales.evolucionInscripciones.valores,
                borderColor: '#2a3441',
                backgroundColor: 'rgba(42, 52, 65, 0.05)',
                fill: true,
                tension: 0.3,
                borderWidth: 2,
                pointBackgroundColor: '#2a3441',
                pointRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: '#f1f5f9',
                }
            },
            x: {
                grid: {
                    display: false,
                }
            }
        }
    };

    const handleExportar = () => {
        alert("Reporte exportado a Excel con éxito (Simulación REQ-REP-002)");
    };

    return (
        <div className="flex flex-col flex-grow bg-white font-sans text-slate-800 p-8">
            <main className="max-w-4xl mx-auto w-full flex-grow flex flex-col">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold mb-2">Panel de Conducción</h1>
                    <h2 className="text-xl text-slate-500">Estadísticas y Reportes Académicos</h2>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <label className="block text-sm font-bold mb-2">Cohorte</label>
                        <select
                            value={cohorteSeleccionada}
                            onChange={(e) => setCohorteSeleccionada(e.target.value)}
                            className="w-full border border-slate-300 rounded p-2 text-slate-600 outline-none focus:border-slate-500 appearance-none bg-white cursor-pointer"
                        >
                            <option value="Todas">Todas</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>
                    <div>
                        {/* Filtro aún no implementado */}
                        <label className="block text-sm font-bold mb-2">Carrera</label>
                        <select className="w-full border border-slate-300 rounded p-2 text-slate-600 outline-none focus:border-slate-500 appearance-none bg-white cursor-pointer">
                            <option>Todas las carreras</option>
                            <option>Especialización</option>
                            <option>Maestría</option>
                            <option>Doctorado</option>
                        </select>
                    </div>
                </div>

                {/* Indicadores dinámicos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="border border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-sm font-bold text-slate-500 mb-2">Total Inscriptos</span>
                        <span className="text-5xl font-extrabold text-[#2a3441]">{datosActuales.totalInscriptos}</span>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-sm font-bold text-slate-500 mb-2">Graduados</span>
                        <span className="text-5xl font-extrabold text-[#2a3441]">{datosActuales.graduados}</span>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-sm font-bold text-slate-500 mb-2">Estudiantes en Riesgo</span>
                        <span className="text-5xl font-extrabold text-[#2a3441]">{datosActuales.estudiantesEnRiesgo}</span>
                    </div>
                </div>

                {/* Gráfico Real con Chart.js */}
                <div className="border border-slate-200 rounded-lg p-6 shadow-sm mb-12">
                    <h3 className="text-sm font-bold mb-6">Evolución de inscripciones</h3>
                    <div className="h-64 w-full">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </div>

                {/* Botón de exportación */}
                <div className="flex justify-end mt-auto">
                    <button
                        type="button"
                        onClick={handleExportar}
                        className="px-8 py-2 border-2 border-slate-800 rounded font-bold hover:bg-slate-50 transition-colors"
                    >
                        Exportar
                    </button>
                </div>
            </main>
        </div>
    );
}