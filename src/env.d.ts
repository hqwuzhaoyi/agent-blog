/// <reference types="astro/client" />
declare namespace App {
  interface Locals { contentDB?: import("./lib/content-store").ContentDatabase }
}
declare module "cloudflare:workers" {
  export const env: { CONTENT: import("./lib/content-store").ContentDatabase };
}
