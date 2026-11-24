import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createJiti } from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const jiti = createJiti(import.meta.url, { jsx: { runtime: 'automatic' } });
const { AuthContext } = await jiti.import('../src/auth/auth-context.ts');
const { default: RequireRole } = await jiti.import('../src/auth/RequireRole.tsx');
const { default: MainLayout } = await jiti.import('../src/layouts/MainLayout.tsx');
const { default: CoordinadorLayout } = await jiti.import('../src/layouts/CoordinadorLayout.tsx');
const { default: AuthLanding } = await jiti.import('../src/pages/AuthLanding.tsx');

function renderConAuth(ui, authOverrides = {}, initialEntries = ['/']) {
    const valorContexto = {
        session: null,
        isLoading: false,
        authError: null,
        login: async () => {
            throw new Error('No implementado en test');
        },
        logout: async () => {},
        ...authOverrides,
    };

    return renderToStaticMarkup(
        React.createElement(
            AuthContext.Provider,
            { value: valorContexto },
            React.createElement(MemoryRouter, { initialEntries }, ui),
        ),
    );
}

describe('Control de acceso por rol y layouts (RequireRole / MainLayout / CoordinadorLayout)', () => {
    it('muestra indicador de carga mientras se verifica la sesión', () => {
        const html = renderConAuth(
            React.createElement(
                Routes,
                null,
                React.createElement(
                    Route,
                    { element: React.createElement(RequireRole, { roles: ['COORDINADOR'] }) },
                    React.createElement(Route, { path: '/', element: React.createElement('div', null, 'Privado') }),
                ),
            ),
            { isLoading: true },
        );

        assert.match(html, /Verificando sesión\.\.\./);
        assert.doesNotMatch(html, /Privado/);
    });

    it('no renderiza la ruta protegida y dispara redirección cuando el usuario no tiene sesión activa', () => {
        const html = renderConAuth(
            React.createElement(
                Routes,
                null,
                React.createElement(
                    Route,
                    { element: React.createElement(RequireRole, { roles: ['COORDINADOR'] }) },
                    React.createElement(Route, {
                        path: '/coordinador',
                        element: React.createElement('div', null, 'Panel Coordinador'),
                    }),
                ),
            ),
            { session: null },
            ['/coordinador'],
        );

        assert.equal(html, '');
        assert.doesNotMatch(html, /Panel Coordinador/);
    });

    it('bloquea con alerta de permisos cuando el rol autenticado no está autorizado (ej. CPR en ruta de COORDINADOR)', () => {
        const html = renderConAuth(
            React.createElement(
                Routes,
                null,
                React.createElement(
                    Route,
                    { element: React.createElement(RequireRole, { roles: ['COORDINADOR', 'ADMIN'] }) },
                    React.createElement(Route, {
                        path: '/coordinador',
                        element: React.createElement('div', null, 'Panel Coordinador'),
                    }),
                ),
            ),
            {
                session: {
                    accessToken: 'tok',
                    refreshToken: 'ref',
                    expiresAt: Date.now() + 60_000,
                    user: { id: '1', email: 'cpr@fenix.test', role: 'CPR' },
                },
            },
            ['/coordinador'],
        );

        assert.match(html, /Tu rol no tiene permisos para acceder a esta sección\./);
        assert.doesNotMatch(html, /Panel Coordinador/);
    });

    it('permite el acceso y muestra enlaces específicos de rol en MainLayout y CoordinadorLayout', () => {
        const htmlCoordinador = renderConAuth(
            React.createElement(
                Routes,
                null,
                React.createElement(
                    Route,
                    { element: React.createElement(MainLayout) },
                    React.createElement(
                        Route,
                        { path: '/coordinador', element: React.createElement(CoordinadorLayout) },
                        React.createElement(Route, {
                            index: true,
                            element: React.createElement('div', null, 'Vista Interna Coordinador'),
                        }),
                    ),
                ),
            ),
            {
                session: {
                    accessToken: 'tok',
                    refreshToken: 'ref',
                    expiresAt: Date.now() + 60_000,
                    user: { id: '1', email: 'admin@fenix.test', role: 'COORDINADOR' },
                },
            },
            ['/coordinador'],
        );

        assert.match(htmlCoordinador, /Formulario de inscripción/);
        assert.match(htmlCoordinador, /Seguimiento de inscripción/);
        assert.match(htmlCoordinador, /Gestión de coordinación/);
        assert.match(htmlCoordinador, /Gestión de Legajos/);
        assert.match(htmlCoordinador, /Panel de Conducción/);
        assert.match(htmlCoordinador, /Gestión Docente/);
        assert.match(htmlCoordinador, /Seguimiento de Graduación/);
        assert.match(htmlCoordinador, /Vista Interna Coordinador/);
    });

    it('muestra acceso a Trabajos Finales para el rol CPR en AuthLanding', () => {
        const htmlCpr = renderConAuth(
            React.createElement(AuthLanding),
            {
                session: {
                    accessToken: 'tok',
                    refreshToken: 'ref',
                    expiresAt: Date.now() + 60_000,
                    user: { id: '2', email: 'cpr@fenix.test', role: 'CPR' },
                },
            },
            ['/acceso'],
        );

        assert.match(htmlCpr, /cpr@fenix\.test/);
        assert.match(htmlCpr, /Ir a Trabajos Finales \(CPR\)/);
    });
});
