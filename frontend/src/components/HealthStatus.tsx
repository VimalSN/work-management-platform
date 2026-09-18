import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type HealthStatus = {
  server: string;
  database: string;
  redis: string;
};

export function HealthStatus() {
  const { data, error } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      try {
        const res = await api.get<HealthStatus>('/health');
        return res.data;
      } catch (err: any) {
        // A 503 still carries a valid health payload (server up, deps down).
        if (err.response?.data) {
          return err.response.data as HealthStatus;
        }
        throw err;
      }
    },
  });

  if (error) {
    return <p className="text-red-600 text-xs py-2">Could not reach backend</p>;
  }
  if (!data) {
    return <p className="text-slate-500 text-xs py-2">Checking system status…</p>;
  }

  return (
    <div className="flex items-center gap-4 py-2 text-xs">
      <StatusDot label="Server" value={data.server} />
      <StatusDot label="Database" value={data.database} />
      <StatusDot label="Redis" value={data.redis} />
    </div>
  );
}

function StatusDot({ label, value }: { label: string; value: string }) {
  const ok = value === 'ok';
  return (
    <span className="flex items-center gap-1.5 text-slate-500">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  );
}
