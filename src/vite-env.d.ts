/// <reference types="vite/client" />

/**
 * Vite client type augmentations.
 *
 * The default vite/client triple-slash directive types `import.meta.env` with
 * the standard built-ins (`MODE`, `BASE_URL`, `PROD`, `DEV`, `SSR`) and an
 * open-ended index signature for `VITE_*` strings. Phase 03-03 reads
 * `import.meta.env.VITE_APP_VERSION` (debug-snapshot) and
 * `import.meta.env.VITE_APP_COMMIT` (About section, future plan); we declare
 * them explicitly here so consumers see them as `string | undefined` instead
 * of `any` from the index signature.
 */
interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
