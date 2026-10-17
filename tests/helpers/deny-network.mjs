// Defense in depth: unit/integration tests may use synthetic mocks, never a service.
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
const denied = () => { throw new Error('External I/O is disabled by the isolated test runner. Use a synthetic fixture.'); };
globalThis.fetch = denied;
net.Socket.prototype.connect = denied;
net.connect = denied;
net.createConnection = denied;
tls.connect = denied;
dgram.createSocket = denied;
syncBuiltinESMExports();
