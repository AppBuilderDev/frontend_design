import { useCallback, useEffect, useState } from 'react';
import { blocksApi } from '../../../services/api';
import type { SavedBlock } from '../../../models/blocks';
import type { ComponentNode } from '../../../models/contracts';
export function useBlocks() {
  const [blocks, setBlocks] = useState<SavedBlock[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      blocksApi
        .list()
        .then((blocks) => {
          setBlocks(blocks);
          setError('');
        })
        .catch((error: Error) => setError(error.message))
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function save(name: string, components: ComponentNode[]) {
    setBusy(true);
    setError('');
    try {
      const saved = await blocksApi.save(name, components);
      setBlocks((blocks) => [...blocks, saved]);
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError('');
    try {
      await blocksApi.remove(id);
      setBlocks((blocks) => blocks.filter((block) => block.id !== id));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return {
    blocks,
    error,
    loading,
    busy,
    load: () => {
      setLoading(true);
      void load();
    },
    save,
    remove,
  };
}
