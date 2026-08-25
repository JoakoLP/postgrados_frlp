// Layout principal de navegación (Iniciar Sesión y Cerrar Sesión)

import { Outlet, Link, useLocation } from 'react-router-dom';

export default function MainLayout() {
    const location = useLocation();

    // Condición simple para saber si estamos en una vista protegida/interna
    const isVistaInterna = location.pathname.includes('/coordinador');

    return (
        <div className="min-h-screen flex flex-col bg-white font-sans text-slate-800">
            {/* Navegador temporal para alternar vistas */}
            <nav className="bg-blue-900 text-white p-4 flex gap-4 shadow-md">
                <a href="/inscripcion" className="hover:underline">Vista Aspirante</a>
                <a href="/coordinador" className="hover:underline">Vista Coordinador</a>
            </nav>
            {/* Header */}
            <header className="flex justify-between items-center p-4 border-b-2 border-slate-800">
                <Link to="/" className="w-12 h-12 border-2 border-slate-800 flex flex-col items-center justify-center font-bold text-xs leading-none hover:bg-slate-50 transition-colors">
                    <span>UTN</span>
                </Link>

                <div className="flex gap-4">
                    {isVistaInterna ? (
                        <Link to="/inscripcion" className="px-4 py-2 border-2 border-slate-800 rounded font-semibold hover:bg-slate-50 transition-colors">
                            Cerrar sesión
                        </Link>
                    ) : (
                        <>
                            <button type="button" className="px-4 py-2 border-2 border-slate-800 rounded font-semibold hover:bg-slate-50 transition-colors">
                                Registrarse
                            </button>
                            <Link to="/coordinador" className="px-4 py-2 bg-[#2a3441] text-white rounded font-semibold hover:bg-slate-700 transition-colors">
                                Iniciar sesión
                            </Link>
                        </>
                    )}
                </div>
            </header>

            {/* Renderizado de Vistas (Inscripción y Coordinador) */}
            <div className="flex-grow flex flex-col">
                <Outlet />
            </div>

        </div>
    );
}