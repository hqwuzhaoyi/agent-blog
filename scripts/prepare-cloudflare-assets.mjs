import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(".cloudflare-assets");
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await cp("dist", join(root, "agent-blog"), { recursive: true });
await rm(join(root, "agent-blog", "preview-audio"), { recursive: true, force: true });
await writeFile(join(root, ".assetsignore"), "agent-blog/preview-audio/**\n");
