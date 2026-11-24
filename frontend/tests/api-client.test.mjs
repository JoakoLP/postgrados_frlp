import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, { jsx: { runtime: 'automatic' } });
const { crearClienteApi } = await jiti.import('../src/shared/api/cliente.ts');
const { extraerErrorApi } = await jiti.import('../src/shared/api/useApiClient.ts');

describe('Cliente HTTP y manejo de errores de API (cliente.ts / useApiClient.ts)', () => {
    it('normaliza la URL base, adjunta Accept y Authorization Bearer cuando hay sesión activa', async () => {
        const llamadas = [];
        const cliente = crearClienteApi({
            urlBase: 'http://localhost:8000/api/v1/',
            autenticacion: {
                obtenerTokenAcceso: () => 'jwt-token-inicial',
                renovarTokenAcceso: async () => null,
                alNoAutorizado: () => {},
            },
            solicitarHttp: async (url, init) => {
                llamadas.push({ url, headers: new Headers(init?.headers) });
                return new Response(JSON.stringify({ ok: true }), { status: 200 });
            },
        });

        const resp = await cliente.solicitar('/legajos');
        assert.equal(resp.status, 200);
        assert.equal(llamadas.length, 1);
        assert.equal(llamadas[0].url, 'http://localhost:8000/api/v1/legajos');
        assert.equal(llamadas[0].headers.get('Accept'), 'application/json');
        assert.equal(llamadas[0].headers.get('Authorization'), 'Bearer jwt-token-inicial');
    });

    it('omite el encabezado Authorization cuando no hay token de acceso', async () => {
        let headersEnviados = null;
        const cliente = crearClienteApi({
            urlBase: 'http://localhost:8000/api/v1',
            autenticacion: {
                obtenerTokenAcceso: () => null,
                renovarTokenAcceso: async () => null,
                alNoAutorizado: () => {},
            },
            solicitarHttp: async (_url, init) => {
                headersEnviados = new Headers(init?.headers);
                return new Response('[]', { status: 200 });
            },
        });

        await cliente.solicitar('cohortes');
        assert.equal(headersEnviados.get('Authorization'), null);
        assert.equal(headersEnviados.get('Accept'), 'application/json');
    });

    it('renueva el token automáticamente ante un 401 y reintenta la solicitud original', async () => {
        const tokensUsados = [];
        let noAutorizadoLlamado = false;
        const cliente = crearClienteApi({
            urlBase: 'http://localhost:8000/api/v1',
            autenticacion: {
                obtenerTokenAcceso: () => 'token-vencido',
                renovarTokenAcceso: async () => 'token-renovado',
                alNoAutorizado: () => {
                    noAutorizadoLlamado = true;
                },
            },
            solicitarHttp: async (_url, init) => {
                const auth = new Headers(init?.headers).get('Authorization');
                tokensUsados.push(auth);
                if (auth === 'Bearer token-vencido') {
                    return new Response(JSON.stringify({ detail: 'Token expirado' }), { status: 401 });
                }
                return new Response(JSON.stringify({ ok: true }), { status: 200 });
            },
        });

        const resp = await cliente.solicitar('/graduacion/estadisticas');
        assert.equal(resp.status, 200);
        assert.deepEqual(tokensUsados, ['Bearer token-vencido', 'Bearer token-renovado']);
        assert.equal(noAutorizadoLlamado, false);
    });

    it('invoca alNoAutorizado cuando falla la renovación del token ante un 401', async () => {
        let cierresDeSesion = 0;
        const cliente = crearClienteApi({
            urlBase: 'http://localhost:8000/api/v1',
            autenticacion: {
                obtenerTokenAcceso: () => 'token-vencido',
                renovarTokenAcceso: async () => null,
                alNoAutorizado: () => {
                    cierresDeSesion += 1;
                },
            },
            solicitarHttp: async () => new Response(JSON.stringify({ detail: 'No autorizado' }), { status: 401 }),
        });

        const resp = await cliente.solicitar('/cohortes/gestion');
        assert.equal(resp.status, 401);
        assert.equal(cierresDeSesion, 1);
    });

    it('extraerErrorApi obtiene mensajes de detalle en string, arreglo de validación 422 o fallback', async () => {
        const respTexto = new Response(JSON.stringify({ detail: 'El DNI ya registra una inscripción en la cohorte' }), {
            status: 409,
        });
        assert.equal(
            await extraerErrorApi(respTexto, 'Error por defecto'),
            'El DNI ya registra una inscripción en la cohorte',
        );

        const respLista = new Response(
            JSON.stringify({
                detail: [{ msg: 'El DNI debe tener entre 7 y 8 dígitos' }, { msg: 'La motivación es demasiado corta' }],
            }),
            { status: 422 },
        );
        assert.equal(
            await extraerErrorApi(respLista, 'Error por defecto'),
            'El DNI debe tener entre 7 y 8 dígitos · La motivación es demasiado corta',
        );

        const respInvalida = new Response('Error interno no JSON', { status: 500 });
        assert.equal(await extraerErrorApi(respInvalida, 'Fallback esperado'), 'Fallback esperado');
    });
});

