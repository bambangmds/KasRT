import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

function getEnvSupabaseUrl(): string {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
      if (match && match[1]) {
        const parsed = match[1].trim().replace(/^["']+|["']+$/g, '').trim();
        if (
          parsed &&
          !parsed.includes('btahiaacjynvjkwfaree') &&
          !parsed.includes('daaqldpxfycjpuxrozjm') &&
          !parsed.includes('yajrxnzwbwtttnwxhrap') &&
          !parsed.includes('your-project')
        ) {
          return parsed;
        }
      }
    }
  } catch {}
  return '';
}

function supabaseProxyPlugin(): Plugin {
  return {
    name: 'vite-plugin-db-query-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url.startsWith('/api/ping') || req.url.startsWith('/api/cron-keepalive'))) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');

              const primaryFallbackUrl = getEnvSupabaseUrl();
              let anonKey = '';
              try {
                const envPath = path.resolve(process.cwd(), '.env');
                if (fs.existsSync(envPath)) {
                  const content = fs.readFileSync(envPath, 'utf-8');
                  const match = content.match(/VITE_SUPABASE_ANON_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
                  if (match && match[1]) anonKey = match[1].trim().replace(/^["']+|["']+$/g, '');
                }
              } catch {}

              let supabaseStatus = 'not_configured';
              if (primaryFallbackUrl && anonKey) {
                try {
                  const pingTarget = `${primaryFallbackUrl.replace(/\/+$/, '')}/rest/v1/kas_rt?select=id&limit=1`;
                  const dbRes = await fetch(pingTarget, {
                    method: 'GET',
                    headers: {
                      'apikey': anonKey,
                      'Authorization': `Bearer ${anonKey}`
                    }
                  });
                  supabaseStatus = dbRes.ok ? 'connected' : `http_${dbRes.status}`;
                } catch (err: any) {
                  supabaseStatus = `error: ${err.message || 'connection_failed'}`;
                }
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                status: 'ok',
                service: 'Kas RT.002 RW.09 API Ping',
                supabase: supabaseStatus,
                timestamp: new Date().toISOString()
              }));
              return;
            }

            if (req.url && req.url.startsWith('/api/db-query-service')) {
              if (req.method === 'OPTIONS') {
                res.statusCode = 204;
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', '*');
                res.end();
                return;
              }

          try {
            const targetPath = req.url.replace(/^\/api\/db-query-service/, '');
            const targetHeader = req.headers['x-target-db-url'] as string | undefined;
            const primaryFallback = getEnvSupabaseUrl();

            let rawTarget = targetHeader || primaryFallback;
            if (
              !rawTarget ||
              rawTarget.includes('btahiaacjynvjkwfaree') ||
              rawTarget.includes('daaqldpxfycjpuxrozjm') ||
              rawTarget.includes('yajrxnzwbwtttnwxhrap') ||
              rawTarget.includes('your-project')
            ) {
              rawTarget = primaryFallback;
            }

            if (!rawTarget) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ error: 'Supabase URL belum dikonfigurasi.' }));
              return;
            }

            let targetBase = rawTarget
              .trim()
              .replace(/^["']+|["']+$/g, '')
              .trim()
              .replace(/\/rest\/v1\/?$/i, '')
              .replace(/\/+$/, '');

            if (!/^https?:\/\//i.test(targetBase)) {
              targetBase = `https://${targetBase}`;
            }

            const forwardHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(req.headers)) {
              if (!value) continue;
              const lowerKey = key.toLowerCase();
              if (['host', 'connection', 'content-length', 'origin', 'referer', 'x-target-db-url'].includes(lowerKey)) continue;
              forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
            }

            let body: Buffer | undefined = undefined;
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              if (chunks.length > 0) {
                body = Buffer.concat(chunks);
              }
            }

            let fullUrl = `${targetBase}${targetPath}`;
            let response: Response;

            const fetchOptions: any = {
              method: req.method,
              headers: forwardHeaders,
            };
            if (body !== undefined && !['GET', 'HEAD'].includes(req.method || '')) {
              fetchOptions.body = body;
            }

            try {
              response = await fetch(fullUrl, fetchOptions);
            } catch (err: any) {
              const fallbackClean = primaryFallback.replace(/\/+$/, '');
              if (primaryFallback && targetBase !== fallbackClean) {
                console.warn(`[Supabase Proxy] Fetch ke ${targetBase} gagal (${err.message}). Mencoba fallback ke ${fallbackClean}...`);
                fullUrl = `${fallbackClean}${targetPath}`;
                response = await fetch(fullUrl, fetchOptions);
              } else {
                throw err;
              }
            }

            res.statusCode = response.status;
            response.headers.forEach((val, key) => {
              if (key.toLowerCase() !== 'content-encoding') {
                res.setHeader(key, val);
              }
            });
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
            return;
          } catch (err: any) {
            console.warn('[Supabase Proxy Handled]', err?.message || err);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ error: err.message || 'Supabase Proxy Error' }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      aistudioMediaPlugin(),
      supabaseProxyPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        },
        includeAssets: ['favicon.ico', 'rt_logo.svg'],
        manifest: {
          id: '/',
          name: 'Sistem Buku Kas & Keuangan RT Digital',
          short_name: 'Kas RT Digital',
          description: 'Sistem Pengelolaan Kas, Keuangan, Inventaris, dan Siaran Informasi Rukun Tetangga (RT) secara digital dan transparan.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/rt_logo.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        devOptions: {
          enabled: false,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
