import { useCallback, useEffect, useState } from 'react';
import type { Entity } from '../../models/data';
import { platformRequest } from '../../services/platformHttp';
export function useEntities(projectId?: string) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!projectId);
  const load = useCallback(
    () =>
      projectId
        ? platformRequest<Entity[]>('/projects/' + projectId + '/entities')
            .then((data) => {
              setEntities(data);
              setError('');
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
        : Promise.resolve(),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { entities, error, loading, load };
}
