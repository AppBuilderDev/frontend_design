export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch((import.meta.env.VITE_PLATFORM_API_URL ?? '') + '/api/v1' + path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'AppBuilderDev',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ message: 'No se pudo conectar con el servidor' }));
    throw new ApiError(
      data.message ?? 'No se pudo completar la operación',
      response.status,
      data.fields,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
