import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { buildEdgeRoutes } from '../lib/edge-routes';

async function main() {
  const [routes, prerender] = await Promise.all([
    readFile('.next/routes-manifest.json', 'utf8').then(JSON.parse),
    readFile('.next/prerender-manifest.json', 'utf8').then(JSON.parse),
  ]);

  const policy = buildEdgeRoutes(routes, prerender);
  await Promise.all([
    writeFile('.open-next/edge-routes.json', JSON.stringify(policy)),
    copyFile('.next/server/app/_not-found.html', '.open-next/assets/404.html'),
  ]);
  console.log(`Prepared edge routing for ${policy.paths.length} paths and ${policy.patterns.length} runtime routes.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
