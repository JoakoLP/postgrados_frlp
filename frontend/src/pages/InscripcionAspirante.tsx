import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function InscripcionAspirante() {
    const [pasoActual, setPasoActual] = useState(1);

    const { register, handleSubmit, trigger, watch, formState: { errors } } = useForm({
        mode: 'onTouched'
    });

    const archivoDni = watch('archivo_dni');
    const archivoTitulo = watch('archivo_titulo');
    const archivoPartida = watch('archivo_partida');
    const archivoBeca = watch('archivo_beca');

    const avanzarPaso = async () => {
        let camposAValidar: string[] = [];

        if (pasoActual === 1) {
            camposAValidar = ['carrera', 'dni', 'nombre', 'apellido', 'email', 'telefono'];
        } else if (pasoActual === 2) {
            camposAValidar = ['nacionalidad', 'domicilio', 'ciudad', 'provincia', 'pais', 'como_conocio', 'titulo_grado', 'motivacion'];
        }

        const esValido = await trigger(camposAValidar as any);
        if (esValido) {
            setPasoActual(prev => Math.min(prev + 1, 3));
        }
    };

    const retrocederPaso = () => setPasoActual(prev => Math.max(prev - 1, 1));

    const onSubmit = (data: any) => {
        console.log('Formulario completo:', data);
        alert('Inscripción finalizada con éxito (Revisá la consola)');
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (pasoActual < 3) {
                await avanzarPaso();
            }
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-white font-sans text-slate-800">

            <main className="flex-grow max-w-xl mx-auto w-full py-10 px-4">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Preinscripción 2026</h1>
                    <h2 className="text-xl text-slate-600">
                        Paso {pasoActual} de 3: {
                            pasoActual === 1 ? 'Datos Personales' :
                                pasoActual === 2 ? 'Datos Personales 2' :
                                    'Carga de Documentos'
                        }
                    </h2>
                </div>

                <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleKeyDown} noValidate className="space-y-5">

                    {/* ================= PASO 1 ================= */}
                    <div className={`space-y-4 animate-fade-in ${pasoActual === 1 ? 'block' : 'hidden'}`}>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Carrera</label>
                            <select
                                {...register('carrera', { required: 'Seleccioná una carrera' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            >
                                <option value="">Seleccionar</option>
                                <option value="Especialización">Especialización</option>
                                <option value="Maestría">Maestría</option>
                                <option value="Doctorado">Doctorado</option>
                            </select>
                            {errors.carrera && <span className="text-red-500 text-xs">{errors.carrera.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">DNI / Pasaporte</label>
                            <input
                                type="text"
                                {...register('dni', { required: 'El DNI es obligatorio' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                            {errors.dni && <span className="text-red-500 text-xs">{errors.dni.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Nombre</label>
                            <input
                                type="text"
                                {...register('nombre', { required: 'El nombre es obligatorio' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                            {errors.nombre && <span className="text-red-500 text-xs">{errors.nombre.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Apellido</label>
                            <input
                                type="text"
                                {...register('apellido', { required: 'El apellido es obligatorio' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                            {errors.apellido && <span className="text-red-500 text-xs">{errors.apellido.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Email</label>
                            <input
                                type="email"
                                {...register('email', { required: 'El email es obligatorio' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                            {errors.email && <span className="text-red-500 text-xs">{errors.email.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Teléfono</label>
                            <input
                                type="text"
                                {...register('telefono', { required: 'El teléfono es obligatorio' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                            {errors.telefono && <span className="text-red-500 text-xs">{errors.telefono.message as string}</span>}
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <label className="text-sm font-semibold">¿Solicitaste beca?</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" {...register('solicita_beca')} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800"></div>
                            </label>
                        </div>
                    </div>

                    {/* ================= PASO 2 ================= */}
                    <div className={`space-y-4 animate-fade-in ${pasoActual === 2 ? 'block' : 'hidden'}`}>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Nacionalidad</label>
                            <input type="text" {...register('nacionalidad', { required: 'La nacionalidad es obligatoria' })} className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none" />
                            {errors.nacionalidad && <span className="text-red-500 text-xs">{errors.nacionalidad.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Domicilio</label>
                            <input type="text" {...register('domicilio', { required: 'El domicilio es obligatorio' })} className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none" />
                            {errors.domicilio && <span className="text-red-500 text-xs">{errors.domicilio.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Ciudad</label>
                            <input type="text" {...register('ciudad', { required: 'La ciudad es obligatoria' })} className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none" />
                            {errors.ciudad && <span className="text-red-500 text-xs">{errors.ciudad.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Provincia</label>
                            <input type="text" {...register('provincia', { required: 'La provincia es obligatoria' })} className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none" />
                            {errors.provincia && <span className="text-red-500 text-xs">{errors.provincia.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">País</label>
                            <input type="text" {...register('pais', { required: 'El país es obligatorio' })} className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none" />
                            {errors.pais && <span className="text-red-500 text-xs">{errors.pais.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">¿Cómo conoció la oferta?</label>
                            <select {...register('como_conocio', { required: 'La forma de conocer la oferta es obligatoria' })} className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none bg-[#2a3441] text-white">
                                <option value="">Seleccione una opción</option>
                                <option value="redes">Redes Sociales (Instagram, Twitter, ...)</option>
                                <option value="colegas">Colegas</option>
                                <option value="web">Sitio Web UTN</option>
                                <option value="egresados">Estudiantes / Egresados UTN</option>
                                <option value="otro">Otro</option>
                            </select>
                            {errors.como_conocio && <span className="text-red-500 text-xs">{errors.como_conocio.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Título de grado</label>
                            <input
                                type="text"
                                {...register('titulo_grado', { required: 'Debe especificar su título de grado' })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            />
                            {errors.titulo_grado && <span className="text-red-500 text-xs">{errors.titulo_grado.message as string}</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Motivación (Mínimo 50 caracteres) *</label>
                            <textarea
                                rows={3}
                                {...register('motivacion', {
                                    required: 'Requerido por el sistema',
                                    minLength: { value: 50, message: 'Faltan caracteres' }
                                })}
                                className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 outline-none"
                            ></textarea>
                            {errors.motivacion && <span className="text-red-500 text-xs">{errors.motivacion.message as string}</span>}
                        </div>
                    </div>

                    {/* ================= PASO 3 ================= */}
                    <div className={`space-y-6 animate-fade-in w-3/4 mx-auto mt-10 ${pasoActual === 3 ? 'block' : 'hidden'}`}>

                        <div className="flex flex-col">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">DNI / Pasaporte</span>
                                <label className="bg-[#2a3441] hover:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 cursor-pointer transition-colors">
                                    <span>+</span> {archivoDni && archivoDni.length > 0 ? 'Cambiar archivo' : 'Cargar archivo'}
                                    <input type="file" className="hidden" accept=".pdf" {...register('archivo_dni', { required: 'Debe adjuntar su DNI' })} />
                                </label>
                            </div>
                            {archivoDni && archivoDni.length > 0 && <span className="text-sm text-green-600 mt-1">✓ {archivoDni[0].name}</span>}
                            {errors.archivo_dni && <span className="text-red-500 text-xs text-right mt-1">{errors.archivo_dni.message as string}</span>}
                        </div>

                        <div className="flex flex-col">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">Título de grado</span>
                                <label className="bg-[#2a3441] hover:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 cursor-pointer transition-colors">
                                    <span>+</span> {archivoTitulo && archivoTitulo.length > 0 ? 'Cambiar archivo' : 'Cargar archivo'}
                                    <input type="file" className="hidden" accept=".pdf" {...register('archivo_titulo', { required: 'Debe adjuntar su título' })} />
                                </label>
                            </div>
                            {archivoTitulo && archivoTitulo.length > 0 && <span className="text-sm text-green-600 mt-1">✓ {archivoTitulo[0].name}</span>}
                            {errors.archivo_titulo && <span className="text-red-500 text-xs text-right mt-1">{errors.archivo_titulo.message as string}</span>}
                        </div>

                        <div className="flex flex-col">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">Partida de nacimiento</span>
                                <label className="bg-[#2a3441] hover:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 cursor-pointer transition-colors">
                                    <span>+</span> {archivoPartida && archivoPartida.length > 0 ? 'Cambiar archivo' : 'Cargar archivo'}
                                    <input type="file" className="hidden" accept=".pdf" {...register('archivo_partida', { required: 'Debe adjuntar su partida de nacimiento' })} />
                                </label>
                            </div>
                            {archivoPartida && archivoPartida.length > 0 && <span className="text-sm text-green-600 mt-1">✓ {archivoPartida[0].name}</span>}
                            {errors.archivo_partida && <span className="text-red-500 text-xs text-right mt-1">{errors.archivo_partida.message as string}</span>}
                        </div>

                        <div className="flex flex-col">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">
                                    Formulario de beca <span className="text-slate-400 font-normal ml-2">Opcional</span>
                                </span>
                                <label className="bg-[#2a3441] hover:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2 cursor-pointer transition-colors">
                                    <span>+</span> {archivoBeca && archivoBeca.length > 0 ? 'Cambiar archivo' : 'Cargar archivo'}
                                    <input type="file" className="hidden" accept=".pdf" {...register('archivo_beca')} />
                                </label>
                            </div>
                            {archivoBeca && archivoBeca.length > 0 && <span className="text-sm text-green-600 mt-1">✓ {archivoBeca[0].name}</span>}
                        </div>

                    </div>

                    <div className="flex justify-between mt-12 pt-6">
                        {pasoActual > 1 ? (
                            <button
                                type="button"
                                onClick={retrocederPaso}
                                className="px-8 py-2 border-2 border-slate-800 rounded font-bold hover:bg-slate-50 transition-colors"
                            >
                                Atras
                            </button>
                        ) : <div />}

                        {pasoActual < 3 ? (
                            <button
                                type="button"
                                onClick={avanzarPaso}
                                className="px-8 py-2 border-2 border-slate-800 rounded font-bold hover:bg-slate-50 transition-colors"
                            >
                                Siguiente
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit(onSubmit)}
                                className="px-8 py-2 border-2 border-slate-800 rounded font-bold hover:bg-slate-50 transition-colors"
                            >
                                Finalizar
                            </button>
                        )}
                    </div>
                </form>
            </main>

            {/* Stepper dinámico del Wizard */}
            <footer className="pb-10 flex justify-center mt-auto">
                <div className="w-full max-w-[16rem] sm:max-w-xs md:max-w-md relative mt-12 flex items-center">

                    <div className="absolute w-full h-[2px] bg-slate-200"></div>

                    <div className={`absolute flex flex-col items-center transition-all duration-300 ease-in-out
                        ${pasoActual === 1 ? 'left-0' :
                            pasoActual === 2 ? 'left-1/2 -translate-x-1/2' :
                                'right-0'}`}
                    >
                        <div className="absolute -top-12">
                            <div className="bg-[#2a3441] text-white w-9 h-9 flex items-center justify-center rounded text-sm font-semibold relative shadow-md">
                                {pasoActual}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#2a3441]"></div>
                            </div>
                        </div>

                        <div className="w-6 h-6 rounded-full border-[3px] border-[#2a3441] bg-white relative z-10"></div>
                    </div>

                </div>
            </footer>
        </div>
    );
}