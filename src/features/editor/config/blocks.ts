import type { ComponentNode } from '../../../models/contracts';
export interface BlockTemplate {
  id: string;
  name: string;
  description: string;
  components: ComponentNode[];
}
const node = (
  id: string,
  type: string,
  props: ComponentNode['props'],
  children?: ComponentNode[],
): ComponentNode => ({ id, type, props, ...(children ? { children } : {}) });
export const starterBlocks: BlockTemplate[] = [
  {
    id: 'header',
    name: 'Encabezado',
    description: 'Marca y enlace principal',
    components: [
      node(
        'header',
        'Container',
        {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '12px',
        },
        [
          node('brand', 'Heading', { text: 'Tu marca', level: 'h2', margin: '0px' }),
          node('nav', 'Button', { text: 'Conocer más', href: '#contenido' }),
        ],
      ),
    ],
  },
  {
    id: 'intro',
    name: 'Presentación',
    description: 'Título, texto y llamada a la acción',
    components: [
      node(
        'intro',
        'Container',
        { padding: '32px', backgroundColor: '#f0effc', borderRadius: '12px', gap: '20px' },
        [
          node('title', 'Heading', { text: 'Una idea que merece su propia página', level: 'h1' }),
          node('text', 'Paragraph', {
            text: 'Cuenta qué ofreces y cómo puedes ayudar a quienes te visitan.',
          }),
          node('action', 'Button', { text: 'Conocer más', href: '#contenido' }),
        ],
      ),
    ],
  },
  {
    id: 'contact',
    name: 'Contacto',
    description: 'Estructura de campos para personalizar',
    components: [
      node(
        'contact',
        'Card',
        {
          title: 'Hablemos',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '640px',
        },
        [
          node('name', 'Input', { label: 'Nombre', placeholder: 'Tu nombre', inputType: 'text' }),
          node('email', 'Input', {
            label: 'Correo',
            placeholder: 'tu@ejemplo.com',
            inputType: 'email',
          }),
          node('info', 'Paragraph', {
            text: 'Conecta tu canal de contacto al botón para recibir consultas.',
          }),
          node('send', 'Button', { text: 'Contactar', href: '' }),
        ],
      ),
    ],
  },
  {
    id: 'footer',
    name: 'Pie de página',
    description: 'Cierre y enlace de navegación',
    components: [
      node(
        'footer',
        'Container',
        {
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px',
          backgroundColor: '#f5f7fb',
        },
        [
          node('copyright', 'Paragraph', {
            text: 'Tu marca. Todos los derechos reservados.',
            margin: '0px',
          }),
          node('link', 'Button', { text: 'Volver arriba', href: '#' }),
        ],
      ),
    ],
  },
];
