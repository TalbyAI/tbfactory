import { execFile } from 'node:child_process';
import { open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execute = promisify(execFile);
// Paths are passed as environment data, never interpolated into shell source.
// Windows cannot fsync a directory through Node; request write-through replacement
// from the documented OS primitive instead. Failure is a backup/activation failure.
const windowsReplace = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class FactoryDurableFile {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool MoveFileExW(string source, string target, uint flags);
}
'@
if (-not [FactoryDurableFile]::MoveFileExW($env:FACTORY_REPLACE_SOURCE, $env:FACTORY_REPLACE_TARGET, 9)) {
  throw ('Durable replacement failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error())
}
`;

export async function atomicWrite(path: string, content: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(content); await file.sync(); } finally { await file.close(); }
    if (process.platform === 'win32') {
      await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', windowsReplace], { windowsHide: true, env: { ...process.env, FACTORY_REPLACE_SOURCE: temporary, FACTORY_REPLACE_TARGET: path } });
    } else {
      await rename(temporary, path);
      const directory = await open(dirname(path), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    }
  } finally { await unlink(temporary).catch(() => {}); }
}
