import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp, ensureDatabaseReady } from '../server';

const app = createExpressApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    try {
      await ensureDatabaseReady();
    } catch (warmupErr) {
      console.warn('[NORVA Vercel DB Warmup Safe Fallback]:', warmupErr);
    }

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

    await new Promise<void>((resolve, reject) => {
      res.on('finish', () => resolve());
      res.on('close', () => resolve());
      res.on('error', (err) => reject(err));
      app(req as never, res as never, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    console.error(
      '[NORVA Vercel Handler Error]:',
      err instanceof Error ? err.stack || err.message : err,
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error:
            'Backend authentication server error. Please verify database connection and environment variables in Vercel settings.',
        }),
      );
    }
  }
}

