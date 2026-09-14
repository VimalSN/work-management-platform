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
    return <p className="text-red-600 text-sm">Could not reach backend</p>;
  }
  if (!data) {
    return <p className="text-slate-500 text-sm">Checking system status…</p>;
  }

  return (
    <ul className="space-y-1">
      <StatusRow label="Server" value={data.server} />
      <StatusRow label="Database" value={data.database} />
      <StatusRow label="Redis" value={data.redis} />
    </ul>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const ok = value === 'ok';
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`px-2 py-0.5 rounded font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {value}
      </span>
    </li>
  );
}
