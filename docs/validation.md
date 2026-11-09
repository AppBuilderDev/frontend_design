# Verificaciones de separacion y sincronizacion TSX v1

Ejecutadas el 9 de noviembre de 2026 en Windows con Node 24.22.2. Las bases usadas por pruebas son temporales y las cuentas de navegador se crean en una instancia aislada.

| Comprobacion                | Backend                | Design                 | Runtime              |
| --------------------------- | ---------------------- | ---------------------- | -------------------- |
| Build / TypeScript estricto | Correcto               | Correcto               | Correcto             |
| ESLint                      | Correcto               | Correcto               | Correcto             |
| Prettier                    | Correcto               | Correcto               | Correcto             |
| Vitest                      | 34 pruebas, 7 archivos | 22 pruebas, 6 archivos | 4 pruebas, 1 archivo |

## Navegador

La bateria completa de 9 escenarios pasa con NestJS, SQLite temporal y los dos frontends: flujo nuevo de catalogo/TSX/tabla CRUD; conexiones externas; Craft/estilos; entidades/datos; inventario operativo; contrasena; rutas publicadas; servicios configurables; editor compacto/movil. El nuevo escenario se repitio despues de los ultimos ajustes del parser y estilos.

El flujo nuevo registra GET/POST/PUT/DELETE desde Design, vincula la tabla, modifica texto desde TSX y desde propiedades visuales, rechaza una expresion no compatible sin alterar el canvas, publica, crea/actualiza/elimina registros en Runtime y comprueba que los IDs de rutas siguen presentes. Capturas locales: test-results/code-sync.png y test-results/rest-runtime.png. No se contactaron proveedores externos reales; el escenario de conexiones usa un proveedor simulado exclusivo de tests/fixtures/api.ts del backend.

Los escenarios comparten IP y proceso de prueba. El lanzador de pruebas elimina su contador compartido de registro antes de cada alta; esta excepcion solo existe en el fixture, no en el servidor normal. Las pruebas de dominio mantienen los controles reales de frecuencia.

## Experimento reproducible

`npm run test:experiment` desde Design produce artifacts/sync-experiment.json: 150 observaciones, 150 comportamientos esperados. Se separan 100 conversiones validas (50 por direccion) de 50 rechazos controlados. Medianas locales de esta ejecucion: visual -> codigo con vuelta de comprobacion 0.2894 ms; codigo -> visual 0.2995 ms. No son latencias de red ni de render completo. Los valores cambian por maquina y ejecucion; no constituyen evidencia de productividad ni usabilidad.

Tambien se verifican hijos vacios, JSON anidado, IDs escapados, agregar/eliminar nodos desde TSX, IDs duplicados, imports no compatibles, spreads, expresiones, sintaxis incompleta y 100 recorridos consecutivos conservando conexiones.

## Datos y compatibilidad

SQLite original respaldado con la API de backup y comparacion de cantidades de usuarios, proyectos, paginas, entidades y registros. Copia activa en backend/data/platform.sqlite y copia previa en backend/data/platform-before-separation.sqlite; ambas fuera de Git. El servidor y sus pruebas se retiraron de Design. No hay imports entre repositorios en codigo de produccion; solo el lanzador E2E conoce las ubicaciones de los tres procesos. Contratos y renderizadores de ambos frontends coinciden; backend conserva contratos equivalentes con extensiones .ts para NodeNext.

## Limites

TSX v1 es un subconjunto declarativo, no React arbitrario. La aplicacion de codigo es explicita y rechaza conflictos. El generador de recursos expone endpoints por metadatos; no genera archivos de controladores Nest. Las rutas del catalogo pertenecen al backend del proyecto; no se habilitaron conectores externos de escritura/OAuth. El archivo Page.tsx requiere el adaptador/contexto de la aplicacion, no es un proyecto standalone.

Se preservan las sesiones, roles, revisiones, inventario y servicios existentes a traves de un adaptador Nest del motor de dominio. Vite mantiene avisos no bloqueantes de anotaciones Zod y tamano del paquete de Design. La bateria legacy no se repitio en esta entrega. No hay pruebas de carga ni certificacion de seguridad de produccion. No se hicieron commits, push ni cambios de remotos.
