import { parse } from '@babel/parser';
import type * as AST from '@babel/types';
import { catalog } from '../../../components/renderer';
import { nodeSchema, validTree, type ComponentNode } from '../../../models/contracts';
const t = {
  isArrayExpression: (node: AST.Node | null | undefined): node is AST.ArrayExpression =>
    node?.type === 'ArrayExpression',
  isBooleanLiteral: (node: AST.Node | null | undefined): node is AST.BooleanLiteral =>
    node?.type === 'BooleanLiteral',
  isExportDefaultDeclaration: (
    node: AST.Node | null | undefined,
  ): node is AST.ExportDefaultDeclaration => node?.type === 'ExportDefaultDeclaration',
  isFunctionDeclaration: (node: AST.Node | null | undefined): node is AST.FunctionDeclaration =>
    node?.type === 'FunctionDeclaration',
  isIdentifier: (node: AST.Node | null | undefined): node is AST.Identifier =>
    node?.type === 'Identifier',
  isImportDeclaration: (node: AST.Node | null | undefined): node is AST.ImportDeclaration =>
    node?.type === 'ImportDeclaration',
  isImportSpecifier: (node: AST.Node | null | undefined): node is AST.ImportSpecifier =>
    node?.type === 'ImportSpecifier',
  isJSXAttribute: (node: AST.Node | null | undefined): node is AST.JSXAttribute =>
    node?.type === 'JSXAttribute',
  isJSXElement: (node: AST.Node | null | undefined): node is AST.JSXElement =>
    node?.type === 'JSXElement',
  isJSXEmptyExpression: (node: AST.Node | null | undefined): node is AST.JSXEmptyExpression =>
    node?.type === 'JSXEmptyExpression',
  isJSXExpressionContainer: (
    node: AST.Node | null | undefined,
  ): node is AST.JSXExpressionContainer => node?.type === 'JSXExpressionContainer',
  isJSXFragment: (node: AST.Node | null | undefined): node is AST.JSXFragment =>
    node?.type === 'JSXFragment',
  isJSXIdentifier: (node: AST.Node | null | undefined): node is AST.JSXIdentifier =>
    node?.type === 'JSXIdentifier',
  isJSXText: (node: AST.Node | null | undefined): node is AST.JSXText => node?.type === 'JSXText',
  isNullLiteral: (node: AST.Node | null | undefined): node is AST.NullLiteral =>
    node?.type === 'NullLiteral',
  isNumericLiteral: (node: AST.Node | null | undefined): node is AST.NumericLiteral =>
    node?.type === 'NumericLiteral',
  isObjectExpression: (node: AST.Node | null | undefined): node is AST.ObjectExpression =>
    node?.type === 'ObjectExpression',
  isObjectProperty: (node: AST.Node | null | undefined): node is AST.ObjectProperty =>
    node?.type === 'ObjectProperty',
  isReturnStatement: (node: AST.Node | null | undefined): node is AST.ReturnStatement =>
    node?.type === 'ReturnStatement',
  isStringLiteral: (node: AST.Node | null | undefined): node is AST.StringLiteral =>
    node?.type === 'StringLiteral',
  isUnaryExpression: (node: AST.Node | null | undefined): node is AST.UnaryExpression =>
    node?.type === 'UnaryExpression',
};
export const CODE_CONTRACT_VERSION = 1;
export interface SyncMeasurement {
  direction: 'visual-to-code' | 'code-to-visual';
  success: boolean;
  durationMs: number;
  nodes: number;
  error?: string;
}
const supported = new Set<string>(catalog);
export function generatePageCode(nodes: ComponentNode[]): string {
  if (!validTree(nodes)) throw new Error('Arbol invalido');
  const types = [...new Set(flatten(nodes).map((n) => n.type))];
  if (types.some((type) => !supported.has(type)))
    throw new Error('Tipo no compatible con el contrato de codigo');
  const render = (items: ComponentNode[], depth: number): string =>
    items
      .map((n) => {
        const spaces = '  '.repeat(depth);
        const start = `${spaces}<${n.type} builderId={${JSON.stringify(n.id)}} config={${JSON.stringify(
          n.props,
          null,
          2,
        )
          .split('\n')
          .join('\n' + spaces)}}`;
        return n.children !== undefined
          ? `${start}>\n${render(n.children, depth + 1)}\n${spaces}</${n.type}>`
          : `${start} />`;
      })
      .join('\n');
  return `// AppBuilderDev TSX contract v${CODE_CONTRACT_VERSION}\nimport { ${types.join(', ')} } from './builder-components';\n\nexport default function Page() {\n  return (\n    <>\n${render(nodes, 3)}\n    </>\n  );\n}\n`;
}
function flatten(nodes: ComponentNode[]): ComponentNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
}
function json(node: AST.Node | null | undefined): unknown {
  if (t.isStringLiteral(node) || t.isBooleanLiteral(node) || t.isNumericLiteral(node))
    return node.value;
  if (t.isNullLiteral(node)) return null;
  if (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument))
    return -node.argument.value;
  if (t.isArrayExpression(node)) return node.elements.map((n) => json(n));
  if (t.isObjectExpression(node)) {
    const value: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop) || prop.computed || prop.shorthand)
        throw new Error('Solo propiedades JSON explicitas');
      const key = t.isIdentifier(prop.key)
        ? prop.key.name
        : t.isStringLiteral(prop.key)
          ? prop.key.value
          : undefined;
      if (
        !key ||
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        Object.hasOwn(value, key)
      )
        throw new Error('Clave JSON no compatible o duplicada');
      value[key] = json(prop.value);
    }
    return value;
  }
  throw new Error('Solo literales JSON: no se ejecutan funciones, variables ni expresiones');
}
export function parsePageCode(source: string): ComponentNode[] {
  if (source.length > 1_000_000) throw new Error('Codigo demasiado grande');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const imports = new Set<string>();
  let declaration: AST.FunctionDeclaration | undefined;
  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      if (statement.source.value !== './builder-components' || statement.importKind === 'type')
        throw new Error('Solo se permite importar ./builder-components');
      for (const specifier of statement.specifiers) {
        if (
          !t.isImportSpecifier(specifier) ||
          !t.isIdentifier(specifier.imported) ||
          specifier.imported.name !== specifier.local.name ||
          !supported.has(specifier.local.name) ||
          imports.has(specifier.local.name)
        )
          throw new Error('Import no compatible');
        imports.add(specifier.local.name);
      }
    } else if (
      t.isExportDefaultDeclaration(statement) &&
      t.isFunctionDeclaration(statement.declaration) &&
      !declaration
    ) {
      declaration = statement.declaration;
    } else throw new Error('Solo imports del registro y export default function Page');
  }
  if (
    !declaration ||
    declaration.id?.name !== 'Page' ||
    declaration.params.length ||
    declaration.async ||
    declaration.generator ||
    declaration.body.body.length !== 1 ||
    !t.isReturnStatement(declaration.body.body[0])
  )
    throw new Error('Page debe contener un unico return JSX');
  const root = declaration.body.body[0].argument;
  let count = 0;
  function children(
    items: (
      | AST.JSXText
      | AST.JSXExpressionContainer
      | AST.JSXSpreadChild
      | AST.JSXElement
      | AST.JSXFragment
    )[],
    depth: number,
  ): ComponentNode[] {
    if (depth > 20) throw new Error('Profundidad maxima 20');
    return items.flatMap((item) => {
      if (t.isJSXText(item) && !item.value.trim()) return [];
      if (t.isJSXExpressionContainer(item) && t.isJSXEmptyExpression(item.expression)) return [];
      if (t.isJSXFragment(item)) return children(item.children, depth);
      if (!t.isJSXElement(item))
        throw new Error('Usa componentes del registro, sin texto JSX ni expresiones');
      return [visit(item, depth)];
    });
  }
  function visit(element: AST.JSXElement, depth: number): ComponentNode {
    if (++count > 500) throw new Error('Maximo 500 componentes');
    const opening = element.openingElement;
    if (
      !t.isJSXIdentifier(opening.name) ||
      !supported.has(opening.name.name) ||
      !imports.has(opening.name.name)
    )
      throw new Error('Componente no registrado o no importado');
    let id: string | undefined;
    let props: Record<string, unknown> | undefined;
    for (const attr of opening.attributes) {
      if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name))
        throw new Error('No se admiten spreads');
      const name = attr.name.name;
      if (name === 'builderId' && !id) {
        if (t.isStringLiteral(attr.value)) id = attr.value.value;
        else if (t.isJSXExpressionContainer(attr.value)) {
          const value = json(attr.value.expression);
          if (typeof value !== 'string') throw new Error('builderId requiere un texto');
          id = value;
        } else throw new Error('builderId requiere un texto');
      } else if (name === 'config' && !props && t.isJSXExpressionContainer(attr.value)) {
        const value = json(attr.value.expression);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('config requiere un objeto JSON');
        props = value as Record<string, unknown>;
      } else throw new Error('Atributo no compatible o duplicado: ' + name);
    }
    if (!id || !props) throw new Error('Cada componente requiere builderId y config');
    const node: ComponentNode = {
      id,
      type: opening.name.name,
      props,
      ...(!opening.selfClosing ? { children: children(element.children, depth + 1) } : {}),
    };
    return nodeSchema.parse(node);
  }
  const nodes = t.isJSXFragment(root)
    ? children(root.children, 0)
    : t.isJSXElement(root)
      ? [visit(root, 0)]
      : (() => {
          throw new Error('El return debe ser JSX');
        })();
  if (!validTree(nodes)) throw new Error('IDs duplicados o estructura invalida');
  return nodes;
}
