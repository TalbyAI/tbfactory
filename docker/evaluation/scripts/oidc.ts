import { startOidc } from '../../../tests/support/oidc.ts';

const port = 18081;
const provider = await startOidc(port, '0.0.0.0');
if (provider.issuer !== `http://127.0.0.1:${port}`)
  throw new Error('Evaluation OIDC issuer is not the expected loopback URL');

process.stdout.write(`Evaluation OIDC provider ready at ${provider.issuer}\n`);

let closing: Promise<void> | undefined;
const close = () => {
  closing ??= provider.close();
  void closing.then(
    () => process.exit(0),
    () => process.exit(1),
  );
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
