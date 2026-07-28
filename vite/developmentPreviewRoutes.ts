import type { Plugin } from 'vite';

const DEVELOPMENT_PREVIEW_ENTRY = '/dev-preview.html';

export function developmentPreviewRoutes(): Plugin {
  return {
    name: 'renaiss-development-preview-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');
        const isDevelopmentPreview =
          requestUrl.pathname === '/' &&
          requestUrl.searchParams.has('preview');

        if (isDevelopmentPreview) {
          request.url = `${DEVELOPMENT_PREVIEW_ENTRY}${requestUrl.search}`;
        }

        next();
      });
    }
  };
}
