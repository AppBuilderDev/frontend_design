import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ComponentNode, Page } from '../../../models/contracts';
import { pagesApi } from '../../../services/api';
import { findNode, mapTree } from '../../../state/tree';
import { defaults } from '../config/catalog';
export function useEditor() {
  const { id } = useParams();
  const [page, setPage] = useState<Page>();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const revision = useRef(0);
  const load = useCallback(() => {
    pagesApi
      .get(id!)
      .then((p) => {
        setPage(p);
        setError('');
        setDirty(false);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function change(nodes: ComponentNode[]) {
    if (!page) return;
    revision.current++;
    setPage({ ...page, components: nodes, status: 'draft' });
    setDirty(true);
  }
  async function save() {
    // Evitar múltiples guardados concurrentes
    if (!page || busy) return;
    setBusy(true);
    setError('');
    const current = revision.current;
    try {
      const saved = await pagesApi.save({ ...page, status: 'published' }, page.id);
      if (revision.current === current) {
        // No hubo cambios nuevos mientras guardaba: actualizamos estado y limpiamos dirty
        setPage(saved);
        setDirty(false);
        setNotice('Cambios guardados y publicados. Ya están disponibles en Runtime.');
      } else {
        // Hubo cambios locales mientras guardaba: informamos sin marcar limpio
        setNotice('Guardado. Tienes cambios locales pendientes adicionales.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const nodes = page?.components ?? [];
  const node = findNode(nodes, selected);
  const containers: ComponentNode[] = [];
  function collect(items: ComponentNode[]) {
    items.forEach((n) => {
      if (
        ['Container', 'Card'].includes(n.type) &&
        n.id !== selected &&
        !findNode(node?.children ?? [], n.id)
      )
        containers.push(n);
      collect(n.children ?? []);
    });
  }
  collect(nodes);
  function prop(key: string, value: string) {
    change(
      mapTree(nodes, selected, (n) => ({
        ...n,
        props: { ...n.props, [key]: value },
      })),
    );
  }
  function add(type: string) {
    const newNode: ComponentNode = {
      id: crypto.randomUUID(),
      type,
      props: { ...defaults[type] },
      ...(['Container', 'Card'].includes(type) ? { children: [] } : {}),
    };
    const target = node && ['Container', 'Card'].includes(node.type) ? node : undefined;
    change(
      target
        ? mapTree(nodes, target.id, (n) => ({
            ...n,
            children: [...(n.children ?? []), newNode],
          }))
        : [...nodes, newNode],
    );
    setSelected(newNode.id);
  }
  return {
    page,
    selected,
    setSelected,
    error,
    notice,
    busy,
    dirty,
    preview,
    setPreview,
    load,
    change,
    save,
    nodes,
    node,
    containers,
    prop,
    add,
  };
}
