// Datos de Prueba: Estadísticas

export interface DatosPanel {
    totalInscriptos: number;
    graduados: number;
    estudiantesEnRiesgo: number;
    evolucionInscripciones: {
        labels: string[];
        valores: number[];
    };
}

export const mockEstadisticas: Record<string, DatosPanel> = {
    "Todas": {
        totalInscriptos: 210,
        graduados: 67,
        estudiantesEnRiesgo: 7,
        evolucionInscripciones: {
            labels: ["2024", "2025", "2026"],
            valores: [120, 165, 210]
        }
    },
    "2026": {
        totalInscriptos: 210,
        graduados: 12,
        estudiantesEnRiesgo: 5,
        evolucionInscripciones: {
            labels: ["Mar", "Abr", "May"],
            valores: [80, 140, 210]
        }
    },
    "2025": {
        totalInscriptos: 165,
        graduados: 45,
        estudiantesEnRiesgo: 2,
        evolucionInscripciones: {
            labels: ["2023", "2024", "2025"],
            valores: [90, 120, 165]
        }
    }
};