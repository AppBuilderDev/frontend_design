import { useCallback, useEffect, useState } from 'react';
import type { ConnectionSummary } from '../../models/connections';
import { platformRequest } from '../../services/platformHttp';
export function useConnections(projectId?: string) {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const load = useCallback(
    () =>
      projectId
        ? platformRequest<ConnectionSummary[]>('/projects/' + projectId + '/connections')
            .then(setConnections)
            .catch(() => setConnections([]))
        : Promise.resolve(),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { connections, load };
}
