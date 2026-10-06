const originalWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...rest) => {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  if (/Graceful shutdown timed out\.|Forcibly closing connections/i.test(text))
    process.send?.({ type: 'forced-shutdown' });
  return originalWrite(chunk, ...rest);
};

process.on('message', (message) => {
  if (message?.type === 'installation-stop') process.emit('SIGTERM');
  if (message?.type === 'installation-exit' && [0, 1].includes(message.exitCode)) {
    process.exitCode = message.exitCode;
    process.disconnect?.();
  }
});
