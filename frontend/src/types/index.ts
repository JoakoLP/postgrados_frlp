// Interfaces

export type EstadoLegajo = 'Borrador' | 'Pendiente' | 'En Revisión' | 'Completado' | 'Observado' | 'Activo' | 'Baja';
export type TipoCarrera = 'Especialización' | 'Maestría' | 'Doctorado';
export type TipoDocumento = 'DNI' | 'TITULO' | 'PARTIDA' | 'CUIT' | 'FORM_INSCRIPCION' | 'FORM_BECA';

export interface Documento {
    id: string;
    legajo_id: string;
    tipo: TipoDocumento;
    path_storage: string;
    fecha_subida: string;
}

export interface Legajo {
    id: string;
    numero_legajo?: string;
    dni: string;
    apellido: string;
    nombre: string;
    email: string;
    telefono: string;
    estado: EstadoLegajo;
    fecha_inscripcion: string;
    tipo_carrera: TipoCarrera;
    solicita_beca: boolean;
    documentos?: Documento[];
}