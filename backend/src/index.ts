import 'dotenv/config';
import { createServer } from 'http';
import { app } from './app';
import { initRealtime } from './realtime';
import { startNotificationsWorker } from './queue/notificationsWorker';

const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

initRealtime(httpServer);
startNotificationsWorker();

httpServer.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
