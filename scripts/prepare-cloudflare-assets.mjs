import { rm, writeFile } from 'node:fs/promises';
// Astro's adapter already puts assets under the configured /agent-blog prefix.
await rm('dist/client/agent-blog/preview-audio',{recursive:true,force:true});
await writeFile('dist/client/.assetsignore','agent-blog/preview-audio/**\n');
