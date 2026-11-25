import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function MainLayout() {
    const { authError, logout, session } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col bg-white font-sans text-slate-800">
            <header className="flex flex-wrap justify-between items-center gap-4 p-4 border-b-2 border-slate-800 bg-white">
                <div className="flex flex-wrap items-center gap-6">
                    <Link to="/" className="w-12 h-12 border-2 border-slate-800 flex flex-col items-center justify-center font-bold text-xs leading-none hover:bg-slate-50 transition-colors shrink-0">
                        <span>UTN</span>
                    </Link>

                    <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-700">
                        <Link to="/inscripcion" className="hover:text-slate-950 hover:underline">Formulario de inscripción</Link>
                        <Link to="/seguimiento" className="hover:text-slate-950 hover:underline">Seguimiento de inscripción</Link>
                        {(session?.user.role === 'COORDINADOR' || session?.user.role === 'ADMIN') && (
                            <Link to="/coordinador" className="hover:text-slate-950 hover:underline">Gestión de coordinación</Link>
                        )}
                        {session?.user.role === 'CPR' && (
                            <Link to="/cpr/trabajos-finales" className="hover:text-slate-950 hover:underline">Trabajos Finales (CPR)</Link>
                        )}
                    </nav>
                </div>

                <div className="flex gap-4 items-center">
                    {session ? (
                        <>
                            <span className="hidden self-center text-sm sm:inline">{session.user.email}</span>
                            <button
                                type="button"
                                onClick={() => void logout().then(() => navigate('/inscripcion', { replace: true }))}
                                className="rounded border-2 border-slate-800 px-4 py-2 font-semibold transition-colors hover:bg-slate-50"
                            >
                                Cerrar sesión
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="rounded bg-[#2a3441] px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-700">
                            Iniciar sesión
                        </Link>
                    )}
                </div>
            </header>

            {authError && location.pathname !== '/login' && (
                <p className="mx-auto mt-4 w-full max-w-3xl rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                    {authError}
                </p>
            )}

            <div className="flex-grow flex flex-col">
                <Outlet />
            </div>

        </div>
    );
}