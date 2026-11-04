import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { pagesApi } from '../../../services/api';
import { pageCodeSchema, type Page } from '../../../models/contracts';
export function usePages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Page | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const load = useCallback(
    () =>
      pagesApi
        .list()
        .then((items) => {
          setPages(items);
          setError('');
        })
        .catch((error: unknown) => {
          setError(error instanceof Error ? error.message : 'Error al cargar');
        })
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = pageCodeSchema.safeParse(data.get('code'));
    if (!code.success) {
      setError(code.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const page = await pagesApi.save(
        {
          name: String(data.get('name')).trim(),
          code: code.data,
          status: editing ? 'published' : 'draft',
          components: editing?.components ?? [],
        },
        editing?.id,
      );
      setEditing(undefined);
      await load();
      setNotice('Página guardada');
      if (!editing) navigate('/editor/' + page.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deletePage() {
    if (!deleting) return;
    setBusy(true);
    try {
      await pagesApi.remove(deleting.id);
      setDeleting(null);
      await load();
      setNotice('Página eliminada');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return {
    pages,
    loading,
    error,
    query,
    setQuery,
    editing,
    setEditing,
    deleting,
    setDeleting,
    busy,
    notice,
    setError,
    load,
    save,
    deletePage,
  };
}
