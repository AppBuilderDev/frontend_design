import { useCallback, useEffect, useState } from 'react';
import type { OperationSummary } from '../../models/operations';
import { platformRequest } from '../../services/platformHttp';
export function useOperations(projectId?: string) {
  const [operations, setOperations] = useState<OperationSummary[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      projectId
        ? platformRequest<OperationSummary[]>('/projects/' + projectId + '/operations')
            .then((result) => {
              setOperations(result);
              setError('');
            })
            .catch((e: Error) => setError(e.message))
        : Promise.resolve(),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { operations, error, load };
}
