# Installation Guide

Stemora — K-12 STEM & Tutoring Platform

## Prerequisites

| Component | Version |
| --- | --- |
| PHP | 8.3+ |
| Composer | 2.x |
| MySQL | 8.x (XAMPP OK) |
| Node.js | 20+ (frontend) |
| Ext | openssl, pdo_mysql, mbstring, tokenizer, xml, ctype, json, fileinfo |

## 1. Clone / open project

```text
C:\xampp\htdocs\learning_platform
```

## 2. Backend

```bash
cd backend
copy .env.example .env   # if needed
composer install
php artisan key:generate
```

Configure `.env`:

```env
APP_NAME=Stemora
APP_URL=http://127.0.0.1:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=learning_platform
DB_USERNAME=root
DB_PASSWORD=
FRONTEND_URL=http://localhost:5173
```

Create database `learning_platform` in phpMyAdmin or:

```bash
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS learning_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Apply schema SQL from `docs/sql/` in chronological order (platform foundation through phase 15–17 billing/notify). Then:

```bash
php artisan migrate
php artisan db:seed   # if seeders configured for roles/demo tenant
php artisan serve --host=127.0.0.1 --port=8000
```

Verify: `GET http://127.0.0.1:8000/api/v1/health`

## 3. Frontend

```bash
cd frontend
npm install
npm run dev:website      # :5173 public site
npm run dev:control      # :5174
npm run dev:institution  # :5175
npm run dev:learner      # :5176
```

## 4. Demo tenant (if seeded)

| Portal | Email | Password |
| --- | --- | --- |
| Control | `owner@alnoor.test` | `Password!456` |
| Institution | `tutor@alnoor.test` | `Password!123` |
| Learner | `student@alnoor.test` / `parent@alnoor.test` | `Password!123` |

Tenant slug: `al-noor`

## 5. Optional queue / mail

```env
QUEUE_CONNECTION=database
MAIL_MAILER=log
NOTIFICATION_EMAIL_DRIVER=log
```

```bash
php artisan queue:work
```
