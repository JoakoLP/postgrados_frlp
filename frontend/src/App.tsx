// Navegación mediante Route

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import CoordinadorLayout from './layouts/CoordinadorLayout';
import InscripcionAspirante from './pages/InscripcionAspirante';
import PanelConduccion from './pages/PanelConduccion';
import GestionDocente from './pages/GestionDocente';
import GestionLegajos from './pages/GestionLegajos';

const NotFound = () => <div className="p-10 text-xl text-red-500 text-center mt-10">404 - Página no encontrada</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Vistas Públicas */}
          <Route path="/" element={<Navigate to="/inscripcion" replace />} />
          <Route path="/inscripcion" element={<InscripcionAspirante />} />
          {/* Vistas Privadas (Coordinador) anidadas en su propio Layout */}
          <Route path="/coordinador" element={<CoordinadorLayout />}>
            <Route index element={<Navigate to="legajos" replace />} />
            <Route path="legajos" element={<GestionLegajos />} />
            <Route path="panel" element={<PanelConduccion />} />
            <Route path="gestion-docente" element={<GestionDocente />} />
          </Route>

        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;