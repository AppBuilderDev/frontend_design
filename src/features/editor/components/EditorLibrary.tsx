import {
  LayoutGrid,
  PanelTop as HeaderIcon,
  PanelBottom,
  Navigation,
  PanelLeft,
  Image as ImageIcon,
  Video,
  UserRound,
  Quote,
  Code,
  CircleAlert,
  BadgeCheck,
  ChartColumn,
  Minus,
  MoveVertical,
  ListCollapse,
  Columns3,
  FormInput,
  CheckSquare,
  ToggleLeft,
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  Link as LinkIcon,
  ListOrdered,
} from 'lucide-react';
import { extraDefinitions } from '../../../components/catalog/definitions';
import {
  Type,
  AlignLeft,
  RectangleHorizontal,
  TextCursorInput,
  SquareDashed,
  PanelTop,
  Table2,
  FileInput,
  List,
  Package,
  Workflow,
  Globe,
  Search,
} from 'lucide-react';
import { componentLabels, componentDescriptions } from '../config/labels';
import { catalog } from '../../../components/renderer';
import { useState, useEffect, useRef } from 'react';
import { Element, useEditor } from '@craftjs/core';
import { CraftBlock } from '../craft/CraftComponents';
import { isContainer } from '../craft/adapter';
import { defaults } from '../config/catalog';

const icons: Record<string, typeof Type> = {
  Section: PanelTop,
  Header: HeaderIcon,
  Footer: PanelBottom,
  Stack: Columns3,
  Grid: LayoutGrid,
  Navbar: Navigation,
  Sidebar: PanelLeft,
  Breadcrumbs: ListOrdered,
  Link: LinkIcon,
  Image: ImageIcon,
  Video,
  Avatar: UserRound,
  List,
  Quote,
  CodeBlock: Code,
  Badge: BadgeCheck,
  Alert: CircleAlert,
  Stat: ChartColumn,
  Progress: SlidersHorizontal,
  Divider: Minus,
  Spacer: MoveVertical,
  Accordion: ListCollapse,
  Tabs: Columns3,
  Textarea: FormInput,
  Select: ChevronDown,
  RadioGroup: ListOrdered,
  Checkbox: CheckSquare,
  Switch: ToggleLeft,
  DatePicker: Calendar,
  NumberInput: TextCursorInput,
  SearchInput: Search,
  Range: SlidersHorizontal,

  Heading: Type,
  Paragraph: AlignLeft,
  Button: RectangleHorizontal,
  Input: TextCursorInput,
  Container: SquareDashed,
  Card: PanelTop,
  DataTable: Table2,
  DataForm: FileInput,
  DataDetail: List,
  Inventory: Package,
  ServiceForm: Workflow,
  ApiQuery: Globe,
};
const basic = ['Heading', 'Paragraph', 'Button', 'Input', 'Container', 'Card'];
const normalize = (text: string) =>
  text
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function PaletteElement({ type, onAdd }: { type: string; onAdd: (type: string) => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { connectors } = useEditor();
  const createRef = useRef(connectors.create);
  useEffect(() => {
    if (buttonRef.current)
      createRef.current(buttonRef.current, () => (
        <Element
          is={CraftBlock}
          canvas={isContainer(type)}
          nodeId={crypto.randomUUID()}
          nodeType={type}
          nodeProps={{ ...defaults[type] }}
        />
      ));
  }, [type]);
  const Icon = icons[type] ?? SquareDashed;
  return (
    <button
      data-component-kind={basic.includes(type) || extraDefinitions[type] ? 'basic' : 'data'}
      ref={buttonRef}
      aria-label={componentLabels[type] ?? type}
      title={componentDescriptions[type]}
      onClick={() => onAdd(type)}
    >
      <Icon size={19} />
      <span>
        {(
          {
            DataTable: 'Tabla',
            DataDetail: 'Detalle',
            ServiceForm: 'Acción',
            ApiQuery: 'Consulta',
            Input: 'Campo',
          } as Record<string, string>
        )[type] ??
          componentLabels[type] ??
          type}
      </span>
    </button>
  );
}

export function EditorLibrary({ onAdd }: { onAdd: (type: string) => void }) {
  const [query, setQuery] = useState('');
  const matches = catalog.filter((type) =>
    normalize((componentLabels[type] ?? type) + ' ' + (componentDescriptions[type] ?? '')).includes(
      normalize(query),
    ),
  );
  return (
    <>
      <label className="element-search">
        <Search size={16} />
        <input
          type="search"
          aria-label="Buscar elementos"
          placeholder="Buscar elemento…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="element-groups">
        {[
          { title: 'Básicos', types: basic },
          {
            title: 'Con tus datos',
            types: catalog.filter((type) => !basic.includes(type) && !extraDefinitions[type]),
          },
          ...[
            ...new Set(Object.values(extraDefinitions).map((definition) => definition.group)),
          ].map((title) => ({
            title,
            types: Object.keys(extraDefinitions).filter(
              (type) => extraDefinitions[type].group === title,
            ),
          })),
        ].map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3>{group.title}</h3>
            <div className="element-list">
              {group.types
                .filter((type) => matches.some((match) => match === type))
                .map((type) => (
                  <PaletteElement key={type} type={type} onAdd={onAdd} />
                ))}
            </div>
          </section>
        ))}
      </div>
      {!matches.length && (
        <p className="panel-help" role="status">
          No hay resultados. Prueba con «texto» o «tabla».
        </p>
      )}
      <p className="library-hint">Haz clic para añadir. También puedes arrastrar a tu página.</p>
    </>
  );
}
