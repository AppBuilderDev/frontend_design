export const defaults: Record<string, Record<string, unknown>> = {
  ServiceForm: { operationId: '', buttonText: 'Ejecutar servicio' },
  Inventory: { title: 'Inventario' },
  DataForm: { entityId: '', action: 'create' },
  DataTable: { entityId: '' },
  DataDetail: { entityId: '' },
  Container: { padding: '24px' },
  Heading: { text: 'Un gran título', level: 'h1' },
  Paragraph: { text: 'Comparte tu historia con el mundo.' },
  Button: { text: 'Comenzar', href: '#' },
  Input: {
    label: 'Tu nombre',
    placeholder: 'Escribe aquí...',
    inputType: 'text',
  },
  Card: { title: 'Una nueva tarjeta' },
};
