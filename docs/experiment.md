# Experimento tecnico de sincronizacion

Pregunta: para el subconjunto TSX v1, los cambios visuales y de codigo se sincronizan correctamente preservando conexiones y comportamiento CRUD?

Variable independiente: via de edicion (visual/codigo). Variables dependientes: conversion correcta, error controlado/no controlado, conservacion de IDs y enlaces HTTP, pruebas funcionales CRUD y duracion local de conversion. Medicion mediante performance.now; la prueba reproducible usa node:perf_hooks. Son tiempos de parser/generador, no tiempos de uso humano ni latencia completa de red/render.

Ejecutar npm run test:experiment (Design). Artefacto: artifacts/sync-experiment.json, con 50 observaciones por escenario (150 total). Los rechazos de expresiones no compatibles cuentan como comportamiento esperado, no como sincronizaciones exitosas de React arbitrario. Se deben reportar separados los errores controlados y las conversiones validas. Las pruebas code-sync.test.ts cubren anidamiento, propiedades JSON, hijos vacios, IDs duplicados, imports, sintaxis y 100 recorridos sin perdida.

Ejecutar npm run test:e2e -- e2e-platform/builder-flow.spec.ts. Usa NestJS real, SQLite temporal y cuentas aisladas. Crea recurso, registra rutas en Design, conecta tabla, cambia texto desde codigo y desde propiedades, rechaza codigo no compatible sin perder diseno, publica y comprueba GET/POST/PUT/DELETE reales en Runtime. Tambien valida que los IDs de rutas sobreviven la publicacion.

El panel Codigo permite descargar mediciones de la sesion. Para un informe academico registrar commit de los tres repositorios, versiones de Node/dependencias, SO, hardware, repeticiones y criterios de exito antes de ejecutar. No inferir mejoras de usabilidad ni ahorro de tiempo; no hay participantes ni comparacion con React manual/IA. Las distribuciones temporales dependen de la maquina y necesitan replicacion.
