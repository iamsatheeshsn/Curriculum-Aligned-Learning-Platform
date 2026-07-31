# Deployment Guide

## Environments

| Env | Purpose |
| --- | --- |
| local | XAMPP + `artisan serve` + Vite |
| staging | Single VPS, MySQL, queue worker |
| production | HTTPS reverse proxy, PHP-FPM, MySQL, workers, backups |

## Build artifacts

```bash
# Backend
cd backend && composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache

# Frontend
cd frontend && npm ci && npm run build
```

Serve SPA `dist/` folders behind Nginx/Apache paths, e.g.:

- `/` → website
- `/control/` → control
- `/org/` → institution  
- `/learn/` → learner  
- `/api/` → Laravel `public/index.php`

## Web server sketch (Nginx)

```nginx
location /api/ {
  try_files $uri $uri/ /index.php?$query_string;
}
location / {
  root /var/www/stemora/website/dist;
  try_files $uri /index.html;
}
```

Set `APP_URL`, `FRONTEND_URL`, and CORS origins (`config/cors.php`) to real portal hosts.

## Process checklist

1. Migrate / apply SQL packages.
2. Seed RBAC + plans.
3. `php artisan storage:link` if media used.
4. Run `queue:work` (or Supervisor) for notifications/jobs.
5. Cron: `* * * * * php artisan schedule:run`.
6. Smoke: `/api/v1/health`, `/api/v1/meta`, admin login.
7. Backup MySQL daily; retain media under `storage/app/tenants`.

## Security hardening

- `APP_DEBUG=false`
- HTTPS only; secure cookies if SPA cookie auth added later
- Restrict Super Admin IP if required
- Rotate Sanctum tokens on privilege change
- Separate DB user with least privilege

## Rollback

Keep previous `dist/` and `backend` release directories; restore DB dump; clear caches (`php artisan optimize:clear`).
