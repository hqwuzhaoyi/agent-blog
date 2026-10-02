import type { ContentDatabase } from "../../cloudflare/content-models";
declare global {
  namespace Cloudflare {
    interface Env {
      CONTENT: ContentDatabase;
      AUDIO: R2Bucket;
    }
  }
}
export {};
