import { createServer, request } from 'node:http';

const target = new URL('http://oidc:18081');
const port = 18081;

const proxy = createServer((incoming, outgoing) => {
  const upstream = request(
    new URL(incoming.url ?? '/', target),
    {
      method: incoming.method,
      headers: { ...incoming.headers, host: target.host },
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  upstream.on('error', () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.pipe(upstream);
});

proxy.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Evaluation OIDC loopback bridge ready on port ${port}\n`);
});

let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  proxy.close(() => process.exit(0));
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
