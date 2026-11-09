import type { ReactNode } from 'react';
import { ComponentView } from './components/renderer';
interface Props {
  builderId: string;
  config: Record<string, unknown>;
  children?: ReactNode;
}
const component = (type: string) =>
  function GeneratedComponent({ builderId, config, children }: Props) {
    return <ComponentView node={{ id: builderId, type, props: config }}>{children}</ComponentView>;
  };
export const Container = component('Container');
export const Heading = component('Heading');
export const Paragraph = component('Paragraph');
export const Button = component('Button');
export const Input = component('Input');
export const Card = component('Card');
export const DataForm = component('DataForm');
export const DataTable = component('DataTable');
export const DataDetail = component('DataDetail');
export const Inventory = component('Inventory');
export const ServiceForm = component('ServiceForm');
export const ApiQuery = component('ApiQuery');
export const RestTable = component('RestTable');
