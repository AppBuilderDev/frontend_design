import { useCallback, useEffect, useState } from 'react';
import { endpointSchema, type Endpoint, type EndpointInput } from '../../models/endpoints';
import { platformRequest } from '../../services/platformHttp';
export function useEndpoints(projectId?: string) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!!projectId);
  const base = '/projects/' + projectId + '/endpoints';
  const load = useCallback(
    () =>
      projectId
        ? platformRequest<unknown>('/projects/' + projectId + '/endpoints')
            .then((data) => {
              setEndpoints(endpointSchema.array().parse(data));
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
  async function save(input: EndpointInput, id?: string, revision?: number) {
    await platformRequest(base + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ ...input, revision }),
    });
    await load();
  }
  async function remove(id: string) {
    await platformRequest(base + '/' + id, { method: 'DELETE' });
    await load();
  }
  return { endpoints, error, loading, load, save, remove };
}
