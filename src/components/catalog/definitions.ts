export interface CatalogField {
  key: string;
  label: string;
  kind: string;
  options?: string[];
}
export interface CatalogDefinition {
  label: string;
  group: string;
  description: string;
  defaults: Record<string, unknown>;
  fields: CatalogField[];
  container: boolean;
}
export const extraDefinitions: Record<string, CatalogDefinition> = {
  Section: {
    label: 'Sección',
    group: 'Estructura',
    description: 'Sección configurable para tu pagina',
    defaults: {
      display: 'block',
      flexDirection: 'column',
      gap: '16px',
      padding: '24px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    fields: [],
    container: true,
  },
  Header: {
    label: 'Header',
    group: 'Estructura',
    description: 'Header configurable para tu pagina',
    defaults: {
      display: 'flex',
      flexDirection: 'row',
      gap: '16px',
      padding: '24px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    fields: [],
    container: true,
  },
  Footer: {
    label: 'Footer',
    group: 'Estructura',
    description: 'Footer configurable para tu pagina',
    defaults: {
      display: 'flex',
      flexDirection: 'row',
      gap: '16px',
      padding: '24px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    fields: [],
    container: true,
  },
  Stack: {
    label: 'Fila / columna',
    group: 'Estructura',
    description: 'Fila / columna configurable para tu pagina',
    defaults: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '24px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    fields: [],
    container: true,
  },
  Grid: {
    label: 'Cuadrícula',
    group: 'Estructura',
    description: 'Cuadrícula configurable para tu pagina',
    defaults: {
      display: 'grid',
      flexDirection: 'column',
      gap: '16px',
      padding: '24px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    fields: [],
    container: true,
  },
  Navbar: {
    label: 'Barra de navegación',
    group: 'Navegación',
    description: 'Barra de navegación configurable para tu pagina',
    defaults: {
      brand: 'Mi aplicación',
      links: 'Inicio|/inicio\nProductos|/productos\nContacto|/contacto',
    },
    fields: [
      {
        key: 'brand',
        label: 'Marca',
        kind: 'text',
      },
      {
        key: 'links',
        label: 'Enlaces: texto|ruta por línea',
        kind: 'textarea',
      },
    ],
    container: true,
  },
  Sidebar: {
    label: 'Menú lateral',
    group: 'Navegación',
    description: 'Menú lateral configurable para tu pagina',
    defaults: {
      brand: 'Mi aplicación',
      links: 'Inicio|/inicio\nProductos|/productos\nContacto|/contacto',
    },
    fields: [
      {
        key: 'brand',
        label: 'Marca',
        kind: 'text',
      },
      {
        key: 'links',
        label: 'Enlaces: texto|ruta por línea',
        kind: 'textarea',
      },
    ],
    container: true,
  },
  Breadcrumbs: {
    label: 'Ruta de navegación',
    group: 'Navegación',
    description: 'Ruta de navegación configurable para tu pagina',
    defaults: {
      links: 'Inicio|/inicio\nProductos|/productos',
    },
    fields: [
      {
        key: 'links',
        label: 'Enlaces: texto|ruta por línea',
        kind: 'textarea',
      },
    ],
    container: false,
  },
  Link: {
    label: 'Enlace',
    group: 'Navegación',
    description: 'Enlace configurable para tu pagina',
    defaults: {
      text: 'Ver productos',
      href: '/productos',
    },
    fields: [
      {
        key: 'text',
        label: 'Texto del enlace',
        kind: 'text',
      },
      {
        key: 'href',
        label: 'Destino del enlace',
        kind: 'text',
      },
    ],
    container: false,
  },
  Image: {
    label: 'Imagen',
    group: 'Contenido',
    description: 'Imagen configurable para tu pagina',
    defaults: {
      src: '',
      alt: 'Descripción de la imagen',
      height: '240px',
      fit: 'cover',
    },
    fields: [
      {
        key: 'src',
        label: 'URL de imagen',
        kind: 'url',
      },
      {
        key: 'alt',
        label: 'Texto alternativo',
        kind: 'text',
      },
      {
        key: 'height',
        label: 'Alto de imagen',
        kind: 'text',
      },
      {
        key: 'fit',
        label: 'Ajuste de imagen',
        kind: 'select',
        options: ['cover', 'contain'],
      },
    ],
    container: false,
  },
  Video: {
    label: 'Video',
    group: 'Contenido',
    description: 'Video configurable para tu pagina',
    defaults: {
      src: '',
      poster: '',
      caption: 'Video de presentación',
    },
    fields: [
      {
        key: 'src',
        label: 'URL del archivo de video',
        kind: 'url',
      },
      {
        key: 'poster',
        label: 'URL de portada',
        kind: 'url',
      },
      {
        key: 'caption',
        label: 'Descripción del video',
        kind: 'text',
      },
    ],
    container: false,
  },
  Avatar: {
    label: 'Avatar',
    group: 'Contenido',
    description: 'Avatar configurable para tu pagina',
    defaults: {
      name: 'Ana Torres',
      src: '',
      size: '48px',
    },
    fields: [
      {
        key: 'name',
        label: 'Nombre del avatar',
        kind: 'text',
      },
      {
        key: 'src',
        label: 'URL del avatar',
        kind: 'url',
      },
      {
        key: 'size',
        label: 'Tamaño del avatar',
        kind: 'text',
      },
    ],
    container: false,
  },
  List: {
    label: 'Lista',
    group: 'Contenido',
    description: 'Lista configurable para tu pagina',
    defaults: {
      items: 'Primera opción\nSegunda opción\nTercera opción',
      ordered: 'false',
    },
    fields: [
      {
        key: 'items',
        label: 'Elementos: uno por línea',
        kind: 'textarea',
      },
      {
        key: 'ordered',
        label: 'Lista numerada',
        kind: 'select',
        options: ['false', 'true'],
      },
    ],
    container: false,
  },
  Quote: {
    label: 'Cita',
    group: 'Contenido',
    description: 'Cita configurable para tu pagina',
    defaults: {
      text: 'Las grandes ideas empiezan con un pequeño paso.',
      author: 'Tu equipo',
    },
    fields: [
      {
        key: 'text',
        label: 'Texto de la cita',
        kind: 'textarea',
      },
      {
        key: 'author',
        label: 'Autor',
        kind: 'text',
      },
    ],
    container: false,
  },
  CodeBlock: {
    label: 'Bloque de código',
    group: 'Contenido',
    description: 'Bloque de código configurable para tu pagina',
    defaults: {
      code: 'const mensaje = "Hola mundo";',
      language: 'JavaScript',
    },
    fields: [
      {
        key: 'code',
        label: 'Código mostrado',
        kind: 'textarea',
      },
      {
        key: 'language',
        label: 'Etiqueta de lenguaje',
        kind: 'text',
      },
    ],
    container: false,
  },
  Badge: {
    label: 'Insignia',
    group: 'Indicadores',
    description: 'Insignia configurable para tu pagina',
    defaults: {
      text: 'Nuevo',
      variant: 'info',
    },
    fields: [
      {
        key: 'text',
        label: 'Contenido',
        kind: 'text',
      },
      {
        key: 'variant',
        label: 'Variante',
        kind: 'select',
        options: ['info', 'success', 'warning', 'danger', 'neutral'],
      },
    ],
    container: false,
  },
  Alert: {
    label: 'Aviso',
    group: 'Indicadores',
    description: 'Aviso configurable para tu pagina',
    defaults: {
      text: 'Información importante',
      variant: 'info',
    },
    fields: [
      {
        key: 'text',
        label: 'Contenido',
        kind: 'text',
      },
      {
        key: 'variant',
        label: 'Variante',
        kind: 'select',
        options: ['info', 'success', 'warning', 'danger', 'neutral'],
      },
    ],
    container: false,
  },
  Stat: {
    label: 'Indicador numérico',
    group: 'Indicadores',
    description: 'Indicador numérico configurable para tu pagina',
    defaults: {
      label: 'Productos',
      value: '128',
      description: 'Disponibles en catálogo',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del indicador',
        kind: 'text',
      },
      {
        key: 'value',
        label: 'Valor mostrado',
        kind: 'text',
      },
      {
        key: 'description',
        label: 'Descripción del indicador',
        kind: 'text',
      },
    ],
    container: false,
  },
  Progress: {
    label: 'Barra de progreso',
    group: 'Indicadores',
    description: 'Barra de progreso configurable para tu pagina',
    defaults: {
      label: 'Progreso',
      value: '65',
      max: '100',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del progreso',
        kind: 'text',
      },
      {
        key: 'value',
        label: 'Progreso actual',
        kind: 'number',
      },
      {
        key: 'max',
        label: 'Valor máximo',
        kind: 'number',
      },
    ],
    container: false,
  },
  Divider: {
    label: 'Separador',
    group: 'Estructura',
    description: 'Separador configurable para tu pagina',
    defaults: {},
    fields: [],
    container: false,
  },
  Spacer: {
    label: 'Espacio',
    group: 'Estructura',
    description: 'Espacio configurable para tu pagina',
    defaults: {
      height: '32px',
    },
    fields: [
      {
        key: 'height',
        label: 'Alto del espacio',
        kind: 'text',
      },
    ],
    container: false,
  },
  Accordion: {
    label: 'Acordeón',
    group: 'Interactivos',
    description: 'Acordeón configurable para tu pagina',
    defaults: {
      items:
        '¿Cómo funciona?|Configura tus páginas desde el editor.\n¿Dónde se guardan los datos?|En el backend de tu aplicación.',
    },
    fields: [
      {
        key: 'items',
        label: 'Preguntas: título|contenido por línea',
        kind: 'textarea',
      },
    ],
    container: false,
  },
  Tabs: {
    label: 'Pestañas',
    group: 'Interactivos',
    description: 'Pestañas configurable para tu pagina',
    defaults: {
      items:
        'Descripción|Presentación del producto.\nDetalles|Información adicional.\nAyuda|Contacta con tu equipo.',
    },
    fields: [
      {
        key: 'items',
        label: 'Pestañas: título|contenido por línea',
        kind: 'textarea',
      },
    ],
    container: false,
  },
  Textarea: {
    label: 'Área de texto',
    group: 'Formularios',
    description: 'Área de texto configurable para tu pagina',
    defaults: {
      label: 'Área de texto',
      placeholder: 'Escribe tu mensaje...',
      rows: '4',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'placeholder',
        label: 'Texto de ayuda',
        kind: 'text',
      },
      {
        key: 'rows',
        label: 'Filas visibles',
        kind: 'number',
      },
    ],
    container: false,
  },
  Select: {
    label: 'Selector',
    group: 'Formularios',
    description: 'Selector configurable para tu pagina',
    defaults: {
      label: 'Selector',
      options: 'Opción A\nOpción B\nOpción C',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'options',
        label: 'Opciones: una por línea',
        kind: 'textarea',
      },
    ],
    container: false,
  },
  RadioGroup: {
    label: 'Opciones de radio',
    group: 'Formularios',
    description: 'Opciones de radio configurable para tu pagina',
    defaults: {
      label: 'Opciones de radio',
      options: 'Opción A\nOpción B',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'options',
        label: 'Opciones: una por línea',
        kind: 'textarea',
      },
    ],
    container: false,
  },
  Checkbox: {
    label: 'Casilla de verificación',
    group: 'Formularios',
    description: 'Casilla de verificación configurable para tu pagina',
    defaults: {
      label: 'Casilla de verificación',
      checked: 'false',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'checked',
        label: 'Activado inicialmente',
        kind: 'select',
        options: ['false', 'true'],
      },
    ],
    container: false,
  },
  Switch: {
    label: 'Interruptor',
    group: 'Formularios',
    description: 'Interruptor configurable para tu pagina',
    defaults: {
      label: 'Interruptor',
      checked: 'false',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'checked',
        label: 'Activado inicialmente',
        kind: 'select',
        options: ['false', 'true'],
      },
    ],
    container: false,
  },
  DatePicker: {
    label: 'Fecha',
    group: 'Formularios',
    description: 'Fecha configurable para tu pagina',
    defaults: {
      label: 'Fecha',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
    ],
    container: false,
  },
  NumberInput: {
    label: 'Campo numérico',
    group: 'Formularios',
    description: 'Campo numérico configurable para tu pagina',
    defaults: {
      label: 'Campo numérico',
      min: '0',
      max: '100',
      step: '1',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'min',
        label: 'Mínimo',
        kind: 'number',
      },
      {
        key: 'max',
        label: 'Máximo',
        kind: 'number',
      },
      {
        key: 'step',
        label: 'Incremento',
        kind: 'number',
      },
    ],
    container: false,
  },
  SearchInput: {
    label: 'Buscador',
    group: 'Formularios',
    description: 'Buscador configurable para tu pagina',
    defaults: {
      label: 'Buscador',
      placeholder: 'Buscar...',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'placeholder',
        label: 'Texto de ayuda',
        kind: 'text',
      },
    ],
    container: false,
  },
  Range: {
    label: 'Deslizador',
    group: 'Formularios',
    description: 'Deslizador configurable para tu pagina',
    defaults: {
      label: 'Deslizador',
      min: '0',
      max: '100',
      step: '1',
      value: '50',
    },
    fields: [
      {
        key: 'label',
        label: 'Etiqueta del campo',
        kind: 'text',
      },
      {
        key: 'min',
        label: 'Mínimo',
        kind: 'number',
      },
      {
        key: 'max',
        label: 'Máximo',
        kind: 'number',
      },
      {
        key: 'step',
        label: 'Incremento',
        kind: 'number',
      },
      {
        key: 'value',
        label: 'Valor inicial',
        kind: 'number',
      },
    ],
    container: false,
  },
};
