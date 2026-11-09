# Catalogo de componentes

45 componentes disponibles, con contrato declarativo y renderizadores equivalentes en Design y Runtime.

| Grupo        | Componentes nuevos                                                                          |
| ------------ | ------------------------------------------------------------------------------------------- |
| Estructura   | Section, Header, Footer, Stack, Grid, Divider, Spacer                                       |
| Navegacion   | Navbar, Sidebar, Breadcrumbs, Link                                                          |
| Contenido    | Image, Video, Avatar, List, Quote, CodeBlock                                                |
| Indicadores  | Badge, Alert, Stat, Progress                                                                |
| Interactivos | Accordion, Tabs                                                                             |
| Formularios  | Textarea, Select, RadioGroup, Checkbox, Switch, DatePicker, NumberInput, SearchInput, Range |

Se conservan los 13 componentes anteriores: Container, Heading, Paragraph, Button, Input, Card, DataForm, DataTable, DataDetail, Inventory, ServiceForm, ApiQuery y RestTable.

Las propiedades especificas aparecen en el inspector. Los contenedores aceptan hijos y controles de layout. Navbar y Sidebar permiten agregar componentes adicionales dentro; sus enlaces se editan con una linea `Texto|/ruta` por entrada. Las rutas internas respetan el slug de la aplicacion.

Accordion y Tabs usan una linea `Titulo|Contenido` por entrada. Tabs soporta flechas, Home y End. Imagen y Video aceptan URLs de archivos; no incluyen carga de archivos ni embeds de proveedores. El avatar muestra iniciales cuando no tiene imagen.

Los campos nuevos son controles independientes: no guardan datos, no ejecutan servicios ni filtran tablas automaticamente. Usa DataForm, RestTable o ServiceForm para persistencia y operaciones. CodeBlock muestra texto y nunca ejecuta el codigo.

## Extension

Las definiciones, valores iniciales y propiedades editables estan en `src/components/catalog/definitions.ts`. Los renderizadores se separan por familia en ese directorio y el registro se integra con `registerComponent`. Cada nuevo tipo debe incorporarse tambien al catalogo autorizado del backend y a los exports de `builder-components.tsx` en Runtime. La sincronizacion TSX v1 conserva propiedades e hijos.

Los repositorios son independientes; mantener estos contratos equivalentes hasta extraer un paquete versionado de componentes y esquemas. No introducir imports de codigo fuente entre repositorios.
