// Datos de prueba: Alumnos

import type { Legajo } from '../types';

export const mockLegajos: Legajo[] = [
    {
        id: '1',
        numero_legajo: '26-001-045',
        dni: '35123456',
        apellido: 'Díaz',
        nombre: 'María Ayelén',
        email: 'mdiaz@test.com',
        telefono: '1122334455',
        estado: 'Activo',
        fecha_inscripcion: '2026-03-01',
        tipo_carrera: 'Especialización',
        solicita_beca: false,
    },
    {
        id: '2',
        dni: '40987654',
        apellido: 'Pérez',
        nombre: 'Juan',
        email: 'jperez@test.com',
        telefono: '1133445566',
        estado: 'Pendiente',
        fecha_inscripcion: '2026-03-10',
        tipo_carrera: 'Maestría',
        solicita_beca: true,
    }
];