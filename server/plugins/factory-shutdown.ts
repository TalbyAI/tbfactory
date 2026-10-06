import { definePlugin } from 'nitro';

export default definePlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    const closeServices = (globalThis as any)[Symbol.for('tbfactory.server.close-services')];
    if (typeof closeServices !== 'function')
      throw new Error('The built application Store close hook is unavailable');
    await closeServices();
    if (process.connected) process.send?.({ type: 'factory-store-closed' });
  });
});
