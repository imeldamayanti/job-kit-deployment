// The only part of the Deno runtime the entrypoints touch, declared here so `npm run typecheck` needs no Deno types package.
declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): unknown
  env: { get(name: string): string | undefined }
}
