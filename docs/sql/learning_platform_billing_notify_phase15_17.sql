-- Phase 17 — Student billing & tutor payments (+ Phase 16 channel logs)
USE `learning_platform`;

CREATE TABLE IF NOT EXISTS `student_invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `number` VARCHAR(64) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'SAR',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `issued_at` DATETIME NULL,
  `due_at` DATETIME NULL,
  `paid_at` DATETIME NULL,
  `notes` TEXT NULL,
  `pdf_path` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_invoices_number_unique` (`tenant_id`, `number`),
  KEY `student_invoices_student_status_index` (`student_user_id`, `status`),
  CONSTRAINT `student_invoices_tenant_foreign` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `student_invoices_school_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `student_invoices_student_foreign` FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `student_invoice_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_invoice_id` BIGINT UNSIGNED NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `student_invoice_items_invoice_index` (`student_invoice_id`),
  CONSTRAINT `student_invoice_items_invoice_foreign`
    FOREIGN KEY (`student_invoice_id`) REFERENCES `student_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tutor_payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `tutoring_session_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'SAR',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `period_start` DATE NULL,
  `period_end` DATE NULL,
  `paid_at` DATETIME NULL,
  `reference` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `tutor_payments_tutor_status_index` (`tutor_profile_id`, `status`),
  CONSTRAINT `tutor_payments_tenant_foreign` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutor_payments_school_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `tutor_payments_tutor_foreign` FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`),
  CONSTRAINT `tutor_payments_session_foreign` FOREIGN KEY (`tutoring_session_id`) REFERENCES `tutoring_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_dispatch_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `channel` VARCHAR(32) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `status` VARCHAR(32) NOT NULL,
  `provider_message_id` VARCHAR(191) NULL,
  `payload_json` JSON NULL,
  `error_message` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notification_dispatch_logs_event_index` (`event_type`, `created_at`),
  KEY `notification_dispatch_logs_user_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
