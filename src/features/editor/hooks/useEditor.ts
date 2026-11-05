import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ComponentNode, Page } from '../../../models/contracts';
import { pagesApi } from '../../../services/api';

export function useEditor() {
  const { id } = useParams();
  const [page, setPage] = useState<Page>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const savedComponents = useRef('');
  const currentComponents = useRef('');
  const load = useCallback(() => {
    pagesApi
      .get(id!)
      .then((p) => {
        savedComponents.current = currentComponents.current = JSON.stringify(p.components);
        setPage(p);
        setError('');
        setDirty(false);
      })
      .catch((e: Error) => setError(e.message));
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
      const timer = setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const change = useCallback((components: ComponentNode[]) => {
    const signature = JSON.stringify(components);
    if (signature === currentComponents.current) return;
    currentComponents.current = signature;
    setPage((p) => (p ? { ...p, components } : p));
    setDirty(signature !== savedComponents.current);
  }, []);
  async function save(components: ComponentNode[]) {
    if (!page || busy) return;
    setBusy(true);
    setError('');
    const signature = JSON.stringify(components);
    try {
      const saved = await pagesApi.save({ ...page, components, status: 'published' }, page.id);
      savedComponents.current = signature;
      setPage((p) => (p ? { ...saved, components: p.components } : saved));
      setDirty(currentComponents.current !== signature);
      setNotice('Cambios guardados y publicados. Ya están disponibles en Runtime.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { page, error, notice, busy, dirty, preview, setPreview, load, change, save };
}
