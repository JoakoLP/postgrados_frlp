import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createJiti } from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Polyfill mínimo de window/document/localStorage para renderizado SSR en Node
globalThis.window = globalThis.window ?? {
    location: { hash: '' },
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
};
globalThis.document = globalThis.document ?? { title: '' };
globalThis.localStorage = globalThis.localStorage ?? {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};

const jiti = createJiti(import.meta.url, { jsx: { runtime: 'automatic' } });
const { AuthContext } = await jiti.import('../src/auth/auth-context.ts');
const { default: Login } = await jiti.import('../src/pages/Login.tsx');
const { default: InscripcionAspirante } = await jiti.import('../src/pages/InscripcionAspirante.tsx');
const { default: SeguimientoInscripcion } = await jiti.import('../src/pages/SeguimientoInscripcion.tsx');
const { default: PlanillaDocente } = await jiti.import('../src/pages/PlanillaDocente.tsx');
const { default: TrabajosFinalesCPR } = await jiti.import('../src/pages/TrabajosFinalesCPR.tsx');
const { default: GestionLegajos } = await jiti.import('../src/pages/GestionLegajos.tsx');
const { default: SeguimientoGraduacion } = await jiti.import('../src/pages/SeguimientoGraduacion.tsx');

function renderVista(element, initialEntries = ['/'], role = 'COORDINADOR') {
    const valorAuth = {
        session: {
            accessToken: 'jwt-test',
            refreshToken: 'refresh-test',
            expiresAt: Date.now() + 3600_000,
            user: { id: '550e8400-e29b-41d4-a716-446655440000', email: 'admin@fenix.test', role },
        },
        isLoading: false,
        authError: null,
        login: async () => {
            throw new Error('No implementado');
        },
        logout: async () => {},
    };

    return renderToStaticMarkup(
        React.createElement(
            AuthContext.Provider,
            { value: valorAuth },
            React.createElement(MemoryRouter, { initialEntries }, element),
        ),
    );
}

describe('Renderizado de páginas principales del Frontend', () => {
    beforeEach(() => {
        globalThis.window.location.hash = '';
    });

    it('renderiza la página de Login con campos de email y contraseña', () => {
        const html = renderVista(React.createElement(Login), ['/login']);
        assert.match(html, /Iniciar sesión/);
        assert.match(html, /Email/);
        assert.match(html, /Contraseña/);
    });

    it('renderiza el formulario wizard de Preinscripción de Aspirante con los 3 pasos y carreras', () => {
        const html = renderVista(React.createElement(InscripcionAspirante), ['/inscripcion']);
        assert.match(html, /Preinscripción 2026/);
        assert.match(html, /Paso 1 de 3: Datos Personales/);
        assert.match(html, /Especialización/);
        assert.match(html, /Maestría/);
        assert.match(html, /Doctorado/);
        assert.match(html, /¿Solicitaste beca\?/);
    });

    it('renderiza el Portal de Seguimiento y Subsanación para el Aspirante (/seguimiento)', () => {
        const html = renderVista(
            React.createElement(SeguimientoInscripcion),
            ['/seguimiento?id=9b1ecf1e-c205-43a3-a22b-ed7c24291893'],
        );
        assert.match(html, /Seguimiento de Inscripción y Legajo/);
        assert.match(html, /9b1ecf1e-c205-43a3-a22b-ed7c24291893/);
        assert.match(html, /Token privado de propietario/);
        assert.match(html, /Confirmar corrección de legajo observado/);
    });

    it('renderiza el Portal Docente (/docente/seminarios/:id) con verificación de token temporal', () => {
        const html = renderVista(
            React.createElement(
                Routes,
                null,
                React.createElement(Route, {
                    path: '/docente/seminarios/:id',
                    element: React.createElement(PlanillaDocente),
                }),
            ),
            ['/docente/seminarios/40982d9c-df3f-44d4-a0f0-8ff0d5e45691'],
        );
        assert.match(html, /Portal Docente · Planilla de Seminario/);
        assert.match(html, /Token de acceso del seminario/);
        assert.match(html, /Abrir planilla/);
    });

    it('renderiza la vista de Trabajos Finales y Avances CPR con selector de estudiante y formularios', () => {
        const html = renderVista(React.createElement(TrabajosFinalesCPR), ['/cpr/trabajos-finales'], 'CPR');
        assert.match(html, /Gestión CPR · Trabajos Finales y Avances/);
        assert.match(html, /Seleccionar Estudiante Activo \/ Graduado/);
        assert.match(html, /Registrar Trabajo Final/);
        assert.match(html, /Registrar Avance de Tesis/);
    });

    it('renderiza Gestión de Legajos con filtros combinados, gestión de cohortes y exportación Excel', () => {
        const html = renderVista(React.createElement(GestionLegajos), ['/coordinador/legajos']);
        assert.match(html, /Gestión de Legajos/);
        assert.match(html, /Gestionar Cohortes e Inscripción/);
        assert.match(html, /Exportar Excel/);
        assert.match(html, /Graduado/);
    });

    it('renderiza Seguimiento de Graduación con planes, asignaciones de alertas y tabla de riesgo', () => {
        const html = renderVista(React.createElement(SeguimientoGraduacion), ['/coordinador/graduacion']);
        assert.match(html, /Seguimiento de Graduación/);
        assert.match(html, /Planes de seminarios por cohorte/);
        assert.match(html, /Coordinadores asignados por carrera \(Destinatarios de Alertas\)/);
        assert.match(html, /Alertas de Riesgo Académico \(Semáforo Rojo\)/);
    });
});

