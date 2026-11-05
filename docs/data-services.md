# Propuesta: endpoints propios con datos

Estado: propuesta para la siguiente etapa. La API existente ya persiste páginas y bloques; todavía no existe un creador visual de entidades ni endpoints de datos de negocio.

## Primer recorrido completo

1. Definir una entidad desde Design, por ejemplo Clientes, con nombre, correo y estado.
2. Declarar tipos de campo y validaciones: texto, número, booleano, fecha y campos obligatorios.
3. Publicar su servicio para listar, consultar por ID, crear, editar y eliminar registros.
4. Conectar el servicio a componentes de Runtime: consulta al cargar, selección de campos de respuesta y acciones de formulario.
5. Mostrar estados de carga, vacío, éxito y error; mantener una consulta de lectura separada de una acción que modifica datos.

Ejemplo de endpoints: GET/POST `/api/data/clientes`, GET/PUT/DELETE `/api/data/clientes/:id`. El listado debe tener paginación y filtros declarados, con límites aplicados por el servidor.

## Organización propuesta

- El backend posee definiciones de entidades, validaciones, permisos, registros y ejecución de operaciones. Las definiciones son declarativas; los endpoints se construyen a partir de operaciones permitidas.
- Design administra las entidades y permite configurar servicios y conexiones visuales.
- Runtime consume los endpoints y presenta resultados y estados de interacción.
- La conexión de un componente guarda el identificador del servicio, operación, parámetros, campos de respuesta y evento de ejecución.
- La misma API TypeScript puede alojar el primer recorrido; para usar datos de negocio conviene disponer de persistencia transaccional, migraciones de esquema y autenticación/autorización desde ese recorrido. El repositorio JSON actual sigue destinado al desarrollo de páginas y bloques.

## Alcance inicial recomendado

Una entidad Clientes, campos simples, CRUD validado, listado paginado y un formulario conectado. Tras validar este recorrido, incorporar relaciones entre entidades, operaciones de negocio y permisos más específicos. Los servicios de terceros y la ejecución de código arbitrario quedan fuera de esta primera etapa solicitada.
