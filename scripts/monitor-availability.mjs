import { appendFile, mkdir, readFile } from 'node:fs/promises';
const directory = '.local/monitoring';
await mkdir(directory, { recursive: true });
const file = `${directory}/availability.jsonl`;
const url = process.env.HEALTH_URL ?? 'https://localhost/api/health';
if (process.argv.includes('--report')) {
  const rows = (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const success = rows.filter((r) => r.ok).length;
  console.log(
    JSON.stringify(
      {
        from: rows[0]?.at,
        to: rows.at(-1)?.at,
        samples: rows.length,
        successful: success,
        availabilityPercent: (100 * success) / rows.length,
        note: 'Amostras a intervalos regulares; não comprova 99% mensal antes de um mês completo. Manutenções precisam ser documentadas separadamente.',
      },
      null,
      2,
    ),
  );
} else {
  const sample = async () => {
    const start = Date.now();
    let ok = false;
    let status = null;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      status = response.status;
      ok = response.ok;
    } catch {}
    await appendFile(
      file,
      JSON.stringify({ at: new Date().toISOString(), ok, status, durationMs: Date.now() - start }) +
        '\n',
    );
  };
  await sample();
  if (!process.argv.includes('--once')) setInterval(() => void sample(), 60000);
}
