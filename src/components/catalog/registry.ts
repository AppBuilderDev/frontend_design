import type { ComponentType } from 'react';
import { extraDefinitions } from './definitions';
import { LayoutComponent, NavigationComponent } from './LayoutComponents';
import { ContentComponent } from './ContentComponents';
import { FormComponent } from './FormComponents';
import { InteractiveComponent } from './InteractiveComponents';
import type { CatalogProps } from './helpers';
export const extraRegistry: Record<string, ComponentType<CatalogProps>> = Object.fromEntries(
  Object.entries(extraDefinitions).map(([type, definition]) => [
    type,
    definition.group === 'Formularios'
      ? FormComponent
      : definition.group === 'Interactivos'
        ? InteractiveComponent
        : ['Navbar', 'Sidebar', 'Breadcrumbs', 'Link'].includes(type)
          ? NavigationComponent
          : definition.container
            ? LayoutComponent
            : ContentComponent,
  ]),
);
