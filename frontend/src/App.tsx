import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type HealthStatus = {
  server: string;
  database: string;
  redis: string;
};

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<HealthStatus>(`${API_URL}/health`)
      .then((res) => setHealth(res.data))
      .catch((err) => {
        // A 503 still carries a valid health payload (server up, dependencies down).
        if (err.response?.data) {
          setHealth(err.response.data);
        } else {
          setError('Could not reach backend');
        }
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white shadow rounded-lg p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold text-slate-900 mb-4">
          Work Management Platform
        </h1>
        {error && <p className="text-red-600">{error}</p>}
        {!error && !health && <p className="text-slate-500">Checking system status…</p>}
        {health && (
          <ul className="space-y-2">
            <StatusRow label="Server" value={health.server} />
            <StatusRow label="Database" value={health.database} />
            <StatusRow label="Redis" value={health.redis} />
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const ok = value === 'ok';
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span
        className={`px-2 py-0.5 rounded text-sm font-medium ${
          ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {value}
      </span>
    </li>
  );
}

export default App;
