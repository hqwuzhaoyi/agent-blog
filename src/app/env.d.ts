import type { ContentDatabase } from "../../cloudflare/content-models";
declare global {
  namespace Cloudflare {
    interface Env {
      PUBLIC_ORIGIN?: string;
      CONTENT: ContentDatabase;
      AUDIO: R2Bucket;
    }
  }
}
export {};
