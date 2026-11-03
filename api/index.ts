import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp, ensureDatabaseReady } from '../server';

const app = createExpressApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await ensureDatabaseReady();

    // Normalize URL if a serverless rewrite forwarded /api/(.*) -> /api?__api_path=$1 or stripped /api
    const rawUrl = req.url || '/api';
    const qIdx = rawUrl.indexOf('?');
    const pathname = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);
    const search = qIdx === -1 ? '' : rawUrl.slice(qIdx + 1);

    if (pathname === '/api' || pathname === '/api/' || pathname === '/api/index') {
      const params = new URLSearchParams(search);
      const rewrittenSubpath = params.get('__api_path');
      if (rewrittenSubpath !== null) {
        params.delete('__api_path');
        const cleanSub = rewrittenSubpath.replace(/^\/+/, '');
        const remainingQuery = params.toString();
        req.url = `/api/${cleanSub}${remainingQuery ? `?${remainingQuery}` : ''}`;
      }
    } else if (!pathname.startsWith('/api/') && pathname !== '/api') {
      req.url = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}${search ? `?${search}` : ''}`;
    }

    app(req as never, res as never);
  } catch (err) {
    console.error('NORVA API handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error: 'NORVA order service encountered a temporary error. Please try again in a moment.',
        }),
      );
    }
  }
}

