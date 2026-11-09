# Contrato AppBuilderDev v1 y separacion de repositorios

Backend NestJS, Design y Runtime son repositorios independientes con instalaciones propias. Los contratos Zod de src/models se mantienen equivalentes; el backend no importa fuentes de los frontends. Futuro: paquete privado versionado con SemVer y pruebas de conformidad en CI. CONTRACT_VERSION=1; endpoints es un campo opcional compatible con paginas previas.

ComponentNode={id,type,props,children?}. El JSON es el contrato de persistencia y Runtime. El adaptador Craft no se publica. Page contiene entidades, contratos de operaciones, conexiones externas y endpoints capturados al publicar. El borrador conserva la publicacion anterior; solo el propietario publica. SQLite y secretos existen exclusivamente en backend/data y backend/.env.

El registro contiene Container, Card, Heading, Paragraph, Button, Input, DataForm, DataTable, DataDetail, Inventory, ServiceForm, ApiQuery y RestTable. RestTable vincula listEndpointId, createEndpointId, updateEndpointId y deleteEndpointId, y un titulo. Campos y ruta de la lista se definen en el catalogo de endpoints por proyecto. Los IDs permanecen iguales en conversiones visuales y de codigo.

## Contrato de codigo

El TSX exportado importa componentes de ./builder-components y declara export default function Page con return JSX. Cada componente recibe builderId y config (JSON literal). Todos los campos JSON, estilos y referencias se conservan. Componentes con children vacio se emiten con cierre explicito, preservando la distincion con children ausente. No se interpretan imports externos ni expresiones ejecutables. El parser de Babel analiza sintaxis; la validacion del contrato rechaza lo que no puede reconstruirse. No se ejecuta el texto.

La sincronizacion visual -> codigo es automatica sin codigo pendiente. Codigo -> visual se aplica explicitamente, valida antes de mutar y rechaza conflictos. La edicion simultanea entre usuarios sigue usando revisiones optimistas; no hay colaboracion en tiempo real.

Descargar Page.tsx requiere el adaptador y el contexto de la aplicacion; no genera un proyecto React standalone ni controladores Nest en archivos. El backend genera endpoints CRUD por definicion de recurso y admite controladores Nest propios. Las APIs externas conservan el gateway de conexiones de lectura; no se habilita HTTP arbitrario del servidor.
