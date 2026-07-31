-- =============================================================================
-- K-12 STEM & Tutoring Platform
-- Phase 4 — Database Schema v1.0
-- Database: learning_platform
-- Engine: InnoDB · utf8mb4_unicode_ci
-- Target: MySQL 8+ / MariaDB 10.4+ (XAMPP)
-- Status: APPROVED — apply to learning_platform
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `learning_platform`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `learning_platform`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- Laravel support
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255) NOT NULL,
  `batch` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` VARCHAR(191) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `payload` LONGTEXT NOT NULL,
  `last_activity` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(255) NOT NULL,
  `tokenable_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `abilities` TEXT NULL,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_index` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue` VARCHAR(255) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL,
  `reserved_at` INT UNSIGNED NULL,
  `available_at` INT UNSIGNED NOT NULL,
  `created_at` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `total_jobs` INT NOT NULL,
  `pending_jobs` INT NOT NULL,
  `failed_jobs` INT NOT NULL,
  `failed_job_ids` LONGTEXT NOT NULL,
  `options` MEDIUMTEXT NULL,
  `cancelled_at` INT NULL,
  `created_at` INT NOT NULL,
  `finished_at` INT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(255) NOT NULL,
  `connection` TEXT NOT NULL,
  `queue` TEXT NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `exception` LONGTEXT NOT NULL,
  `failed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cache` (
  `key` VARCHAR(191) NOT NULL,
  `value` MEDIUMTEXT NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` VARCHAR(191) NOT NULL,
  `owner` VARCHAR(255) NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Countries
-- -----------------------------------------------------------------------------

CREATE TABLE `countries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` CHAR(2) NOT NULL,
  `name_en` VARCHAR(100) NOT NULL,
  `name_ar` VARCHAR(100) NOT NULL,
  `default_locale` VARCHAR(10) NOT NULL DEFAULT 'en',
  `default_timezone` VARCHAR(64) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `countries_code_unique` (`code`),
  KEY `countries_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- SaaS: tenants, plans, branding, billing
-- -----------------------------------------------------------------------------

CREATE TABLE `subscription_plans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` CHAR(3) NOT NULL DEFAULT 'SAR',
  `max_schools` INT UNSIGNED NULL,
  `max_campuses` INT UNSIGNED NULL,
  `max_students` INT UNSIGNED NULL,
  `max_teachers` INT UNSIGNED NULL,
  `max_storage_mb` INT UNSIGNED NULL,
  `modules_json` JSON NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscription_plans_code_unique` (`code`),
  KEY `subscription_plans_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `legal_name` VARCHAR(191) NULL,
  `primary_country_id` BIGINT UNSIGNED NULL,
  `default_locale` VARCHAR(10) NOT NULL DEFAULT 'en',
  `default_timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Riyadh',
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `trial_ends_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenants_slug_unique` (`slug`),
  KEY `tenants_status_index` (`status`),
  KEY `tenants_primary_country_id_index` (`primary_country_id`),
  KEY `tenants_deleted_at_index` (`deleted_at`),
  CONSTRAINT `tenants_primary_country_id_foreign`
    FOREIGN KEY (`primary_country_id`) REFERENCES `countries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `plan_id` BIGINT UNSIGNED NOT NULL,
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_subscriptions_tenant_status_index` (`tenant_id`, `status`),
  KEY `tenant_subscriptions_plan_id_index` (`plan_id`),
  CONSTRAINT `tenant_subscriptions_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tenant_subscriptions_plan_id_foreign`
    FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_branding` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `logo_path` VARCHAR(500) NULL,
  `favicon_path` VARCHAR(500) NULL,
  `primary_color` VARCHAR(32) NULL,
  `secondary_color` VARCHAR(32) NULL,
  `email_footer_en` TEXT NULL,
  `email_footer_ar` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_branding_tenant_id_unique` (`tenant_id`),
  CONSTRAINT `tenant_branding_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `number` VARCHAR(64) NOT NULL,
  `currency` CHAR(3) NOT NULL,
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
  UNIQUE KEY `invoices_number_unique` (`number`),
  KEY `invoices_tenant_status_index` (`tenant_id`, `status`),
  KEY `invoices_due_at_index` (`due_at`),
  CONSTRAINT `invoices_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoice_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `line_total` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `invoice_items_invoice_id_index` (`invoice_id`),
  CONSTRAINT `invoice_items_invoice_id_foreign`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `method` VARCHAR(32) NOT NULL DEFAULT 'manual',
  `reference` VARCHAR(191) NULL,
  `paid_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `payments_invoice_id_index` (`invoice_id`),
  KEY `payments_tenant_paid_at_index` (`tenant_id`, `paid_at`),
  CONSTRAINT `payments_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `payments_invoice_id_foreign`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------

CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `first_name_ar` VARCHAR(100) NULL,
  `last_name_ar` VARCHAR(100) NULL,
  `phone` VARCHAR(32) NULL,
  `locale` VARCHAR(10) NOT NULL DEFAULT 'en',
  `timezone` VARCHAR(64) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `email_verified_at` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `remember_token` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_tenant_email_unique` (`tenant_id`, `email`),
  KEY `users_status_index` (`status`),
  KEY `users_deleted_at_index` (`deleted_at`),
  CONSTRAINT `users_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(100) NOT NULL,
  `name_ar` VARCHAR(100) NOT NULL,
  `portal` VARCHAR(32) NOT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_code_unique` (`code`),
  KEY `roles_portal_index` (`portal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- School structure
-- -----------------------------------------------------------------------------

CREATE TABLE `schools` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `country_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `timezone` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `schools_tenant_code_unique` (`tenant_id`, `code`),
  KEY `schools_tenant_status_index` (`tenant_id`, `status`),
  KEY `schools_country_id_index` (`country_id`),
  CONSTRAINT `schools_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `schools_country_id_foreign`
    FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `campuses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `timezone` VARCHAR(64) NULL,
  `address` VARCHAR(500) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `campuses_school_code_unique` (`school_id`, `code`),
  KEY `campuses_tenant_school_index` (`tenant_id`, `school_id`),
  CONSTRAINT `campuses_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `campuses_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `academic_years` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `starts_on` DATE NOT NULL,
  `ends_on` DATE NOT NULL,
  `is_current` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'planned',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `academic_years_school_current_index` (`school_id`, `is_current`),
  KEY `academic_years_tenant_school_index` (`tenant_id`, `school_id`),
  CONSTRAINT `academic_years_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `academic_years_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `terms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `academic_year_id` BIGINT UNSIGNED NOT NULL,
  `name_en` VARCHAR(100) NOT NULL,
  `name_ar` VARCHAR(100) NOT NULL,
  `sequence` INT UNSIGNED NOT NULL DEFAULT 1,
  `starts_on` DATE NOT NULL,
  `ends_on` DATE NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'upcoming',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `terms_year_sequence_index` (`academic_year_id`, `sequence`),
  CONSTRAINT `terms_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `terms_academic_year_id_foreign`
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grades` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `name_en` VARCHAR(100) NOT NULL,
  `name_ar` VARCHAR(100) NOT NULL,
  `sequence` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grades_school_code_unique` (`school_id`, `code`),
  KEY `grades_school_sequence_index` (`school_id`, `sequence`),
  CONSTRAINT `grades_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `grades_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `class_sections` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `campus_id` BIGINT UNSIGNED NULL,
  `academic_year_id` BIGINT UNSIGNED NOT NULL,
  `grade_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `section_code` VARCHAR(32) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `class_sections_school_year_grade_index` (`school_id`, `academic_year_id`, `grade_id`),
  KEY `class_sections_campus_id_index` (`campus_id`),
  CONSTRAINT `class_sections_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `class_sections_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `class_sections_campus_id_foreign`
    FOREIGN KEY (`campus_id`) REFERENCES `campuses` (`id`),
  CONSTRAINT `class_sections_academic_year_id_foreign`
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`),
  CONSTRAINT `class_sections_grade_id_foreign`
    FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_tenant_roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `role_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NULL,
  `campus_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_tenant_roles_unique` (`user_id`, `tenant_id`, `role_id`, `school_id`, `campus_id`),
  KEY `user_tenant_roles_tenant_role_index` (`tenant_id`, `role_id`),
  KEY `user_tenant_roles_school_id_index` (`school_id`),
  CONSTRAINT `user_tenant_roles_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_tenant_roles_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `user_tenant_roles_role_id_foreign`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `user_tenant_roles_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `user_tenant_roles_campus_id_foreign`
    FOREIGN KEY (`campus_id`) REFERENCES `campuses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `parent_student_links` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `parent_user_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `relationship` VARCHAR(32) NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `parent_student_links_unique` (`parent_user_id`, `student_user_id`),
  KEY `parent_student_links_tenant_student_index` (`tenant_id`, `student_user_id`),
  CONSTRAINT `parent_student_links_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `parent_student_links_parent_user_id_foreign`
    FOREIGN KEY (`parent_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `parent_student_links_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `enrollments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `academic_year_id` BIGINT UNSIGNED NOT NULL,
  `class_section_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `grade_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `enrolled_on` DATE NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `enrollments_student_year_class_unique` (`student_user_id`, `academic_year_id`, `class_section_id`),
  KEY `enrollments_tenant_school_status_index` (`tenant_id`, `school_id`, `status`),
  KEY `enrollments_class_section_id_index` (`class_section_id`),
  CONSTRAINT `enrollments_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `enrollments_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `enrollments_academic_year_id_foreign`
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`),
  CONSTRAINT `enrollments_class_section_id_foreign`
    FOREIGN KEY (`class_section_id`) REFERENCES `class_sections` (`id`),
  CONSTRAINT `enrollments_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `enrollments_grade_id_foreign`
    FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Curriculum & learning
-- -----------------------------------------------------------------------------

CREATE TABLE `curricula` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `school_id` BIGINT UNSIGNED NULL,
  `country_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `version` VARCHAR(32) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `source_curriculum_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `curricula_tenant_school_index` (`tenant_id`, `school_id`),
  KEY `curricula_country_id_index` (`country_id`),
  CONSTRAINT `curricula_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `curricula_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `curricula_country_id_foreign`
    FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`),
  CONSTRAINT `curricula_source_curriculum_id_foreign`
    FOREIGN KEY (`source_curriculum_id`) REFERENCES `curricula` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subjects` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `curriculum_id` BIGINT UNSIGNED NULL,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `is_stem` TINYINT(1) NOT NULL DEFAULT 1,
  `tutoring_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subjects_school_code_unique` (`school_id`, `code`),
  KEY `subjects_tenant_school_index` (`tenant_id`, `school_id`),
  CONSTRAINT `subjects_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `subjects_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `subjects_curriculum_id_foreign`
    FOREIGN KEY (`curriculum_id`) REFERENCES `curricula` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `chapters` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NOT NULL,
  `grade_id` BIGINT UNSIGNED NOT NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ar` VARCHAR(255) NOT NULL,
  `sequence` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `chapters_subject_grade_sequence_index` (`subject_id`, `grade_id`, `sequence`),
  KEY `chapters_tenant_school_index` (`tenant_id`, `school_id`),
  CONSTRAINT `chapters_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `chapters_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `chapters_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `chapters_grade_id_foreign`
    FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `curriculum_lessons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `chapter_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(64) NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ar` VARCHAR(255) NOT NULL,
  `summary_en` TEXT NULL,
  `summary_ar` TEXT NULL,
  `sequence` INT UNSIGNED NOT NULL DEFAULT 1,
  `estimated_minutes` INT UNSIGNED NULL,
  `difficulty` VARCHAR(32) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `curriculum_lessons_chapter_sequence_index` (`chapter_id`, `sequence`),
  KEY `curriculum_lessons_tenant_school_status_index` (`tenant_id`, `school_id`, `status`),
  CONSTRAINT `curriculum_lessons_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `curriculum_lessons_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `curriculum_lessons_chapter_id_foreign`
    FOREIGN KEY (`chapter_id`) REFERENCES `chapters` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `learning_outcomes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NULL,
  `code` VARCHAR(64) NOT NULL,
  `statement_en` TEXT NOT NULL,
  `statement_ar` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `learning_outcomes_school_code_unique` (`school_id`, `code`),
  KEY `learning_outcomes_subject_id_index` (`subject_id`),
  CONSTRAINT `learning_outcomes_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `learning_outcomes_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `learning_outcomes_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lesson_learning_outcomes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `curriculum_lesson_id` BIGINT UNSIGNED NOT NULL,
  `learning_outcome_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lesson_learning_outcomes_unique` (`curriculum_lesson_id`, `learning_outcome_id`),
  CONSTRAINT `lesson_learning_outcomes_lesson_foreign`
    FOREIGN KEY (`curriculum_lesson_id`) REFERENCES `curriculum_lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lesson_learning_outcomes_outcome_foreign`
    FOREIGN KEY (`learning_outcome_id`) REFERENCES `learning_outcomes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `media_assets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NULL,
  `type` VARCHAR(32) NOT NULL,
  `title_en` VARCHAR(255) NULL,
  `title_ar` VARCHAR(255) NULL,
  `disk_path` VARCHAR(500) NULL,
  `external_url` VARCHAR(1000) NULL,
  `mime_type` VARCHAR(128) NULL,
  `size_bytes` BIGINT UNSIGNED NULL,
  `duration_seconds` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `media_assets_tenant_school_type_index` (`tenant_id`, `school_id`, `type`),
  CONSTRAINT `media_assets_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `media_assets_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `interactive_lessons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `curriculum_lesson_id` BIGINT UNSIGNED NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ar` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `completion_rule` VARCHAR(32) NOT NULL DEFAULT 'view_all',
  `published_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `interactive_lessons_tenant_school_status_index` (`tenant_id`, `school_id`, `status`),
  KEY `interactive_lessons_curriculum_lesson_id_index` (`curriculum_lesson_id`),
  CONSTRAINT `interactive_lessons_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `interactive_lessons_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `interactive_lessons_curriculum_lesson_id_foreign`
    FOREIGN KEY (`curriculum_lesson_id`) REFERENCES `curriculum_lessons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lesson_blocks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `interactive_lesson_id` BIGINT UNSIGNED NOT NULL,
  `block_type` VARCHAR(32) NOT NULL,
  `sequence` INT UNSIGNED NOT NULL,
  `payload_json` JSON NOT NULL,
  `media_asset_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `lesson_blocks_lesson_sequence_index` (`interactive_lesson_id`, `sequence`),
  CONSTRAINT `lesson_blocks_interactive_lesson_id_foreign`
    FOREIGN KEY (`interactive_lesson_id`) REFERENCES `interactive_lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lesson_blocks_media_asset_id_foreign`
    FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lesson_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `interactive_lesson_id` BIGINT UNSIGNED NOT NULL,
  `class_section_id` BIGINT UNSIGNED NULL,
  `student_user_id` BIGINT UNSIGNED NULL,
  `assigned_by` BIGINT UNSIGNED NULL,
  `due_at` DATETIME NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'assigned',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `lesson_assignments_class_due_index` (`class_section_id`, `due_at`),
  KEY `lesson_assignments_student_user_id_index` (`student_user_id`),
  KEY `lesson_assignments_interactive_lesson_id_index` (`interactive_lesson_id`),
  CONSTRAINT `lesson_assignments_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `lesson_assignments_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `lesson_assignments_interactive_lesson_id_foreign`
    FOREIGN KEY (`interactive_lesson_id`) REFERENCES `interactive_lessons` (`id`),
  CONSTRAINT `lesson_assignments_class_section_id_foreign`
    FOREIGN KEY (`class_section_id`) REFERENCES `class_sections` (`id`),
  CONSTRAINT `lesson_assignments_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `lesson_assignments_assigned_by_foreign`
    FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `learning_progress` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `interactive_lesson_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'not_started',
  `progress_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `score` DECIMAL(8,2) NULL,
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `last_position_json` JSON NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `learning_progress_student_lesson_unique` (`student_user_id`, `interactive_lesson_id`),
  KEY `learning_progress_tenant_school_status_index` (`tenant_id`, `school_id`, `status`),
  KEY `learning_progress_completed_at_index` (`completed_at`),
  CONSTRAINT `learning_progress_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `learning_progress_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `learning_progress_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `learning_progress_interactive_lesson_id_foreign`
    FOREIGN KEY (`interactive_lesson_id`) REFERENCES `interactive_lessons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NULL,
  `class_section_id` BIGINT UNSIGNED NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ar` VARCHAR(255) NOT NULL,
  `instructions_en` TEXT NULL,
  `instructions_ar` TEXT NULL,
  `due_at` DATETIME NULL,
  `allow_late` TINYINT(1) NOT NULL DEFAULT 1,
  `is_scored` TINYINT(1) NOT NULL DEFAULT 0,
  `max_score` DECIMAL(8,2) NULL,
  `include_in_reports` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(32) NOT NULL DEFAULT 'published',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `assignments_school_due_index` (`school_id`, `due_at`),
  KEY `assignments_class_status_index` (`class_section_id`, `status`),
  CONSTRAINT `assignments_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `assignments_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `assignments_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `assignments_class_section_id_foreign`
    FOREIGN KEY (`class_section_id`) REFERENCES `class_sections` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignment_submissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `assignment_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `body_text` TEXT NULL,
  `file_path` VARCHAR(500) NULL,
  `submitted_at` DATETIME NULL,
  `is_late` TINYINT(1) NOT NULL DEFAULT 0,
  `score` DECIMAL(8,2) NULL,
  `feedback` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assignment_submissions_unique` (`assignment_id`, `student_user_id`),
  KEY `assignment_submissions_tenant_status_index` (`tenant_id`, `status`),
  CONSTRAINT `assignment_submissions_assignment_id_foreign`
    FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`),
  CONSTRAINT `assignment_submissions_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `assignment_submissions_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Assessments
-- -----------------------------------------------------------------------------

CREATE TABLE `questions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NULL,
  `type` VARCHAR(32) NOT NULL,
  `difficulty` VARCHAR(32) NULL,
  `default_points` DECIMAL(8,2) NOT NULL DEFAULT 1.00,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `questions_tenant_school_type_index` (`tenant_id`, `school_id`, `type`),
  KEY `questions_subject_id_index` (`subject_id`),
  CONSTRAINT `questions_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `questions_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `questions_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `question_translations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(10) NOT NULL,
  `stem` TEXT NOT NULL,
  `explanation` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `question_translations_unique` (`question_id`, `locale`),
  CONSTRAINT `question_translations_question_id_foreign`
    FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `question_options` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `locale` VARCHAR(10) NOT NULL,
  `label` VARCHAR(500) NOT NULL,
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
  `sequence` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `question_options_question_locale_sequence_index` (`question_id`, `locale`, `sequence`),
  CONSTRAINT `question_options_question_id_foreign`
    FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `question_outcomes` (
  `question_id` BIGINT UNSIGNED NOT NULL,
  `learning_outcome_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`question_id`, `learning_outcome_id`),
  CONSTRAINT `question_outcomes_question_id_foreign`
    FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `question_outcomes_learning_outcome_id_foreign`
    FOREIGN KEY (`learning_outcome_id`) REFERENCES `learning_outcomes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assessments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NULL,
  `term_id` BIGINT UNSIGNED NULL,
  `class_section_id` BIGINT UNSIGNED NULL,
  `type` VARCHAR(32) NOT NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ar` VARCHAR(255) NOT NULL,
  `instructions_en` TEXT NULL,
  `instructions_ar` TEXT NULL,
  `time_limit_seconds` INT UNSIGNED NULL,
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 1,
  `available_from` DATETIME NULL,
  `available_until` DATETIME NULL,
  `shuffle_questions` TINYINT(1) NOT NULL DEFAULT 0,
  `show_results` VARCHAR(32) NOT NULL DEFAULT 'after_submit',
  `counts_toward_grade` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `assessments_tenant_school_type_status_index` (`tenant_id`, `school_id`, `type`, `status`),
  KEY `assessments_class_available_index` (`class_section_id`, `available_from`),
  KEY `assessments_term_id_index` (`term_id`),
  CONSTRAINT `assessments_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `assessments_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `assessments_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `assessments_term_id_foreign`
    FOREIGN KEY (`term_id`) REFERENCES `terms` (`id`),
  CONSTRAINT `assessments_class_section_id_foreign`
    FOREIGN KEY (`class_section_id`) REFERENCES `class_sections` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assessment_questions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `assessment_id` BIGINT UNSIGNED NOT NULL,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `sequence` INT UNSIGNED NOT NULL,
  `points` DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assessment_questions_unique` (`assessment_id`, `question_id`),
  KEY `assessment_questions_assessment_sequence_index` (`assessment_id`, `sequence`),
  CONSTRAINT `assessment_questions_assessment_id_foreign`
    FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assessment_questions_question_id_foreign`
    FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assessment_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `assessment_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `attempt_no` INT UNSIGNED NOT NULL,
  `locale` VARCHAR(10) NOT NULL DEFAULT 'en',
  `status` VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  `score` DECIMAL(8,2) NULL,
  `max_score` DECIMAL(8,2) NULL,
  `started_at` DATETIME NULL,
  `submitted_at` DATETIME NULL,
  `graded_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assessment_attempts_unique` (`assessment_id`, `student_user_id`, `attempt_no`),
  KEY `assessment_attempts_tenant_student_index` (`tenant_id`, `student_user_id`),
  KEY `assessment_attempts_status_index` (`status`),
  CONSTRAINT `assessment_attempts_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `assessment_attempts_assessment_id_foreign`
    FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`),
  CONSTRAINT `assessment_attempts_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assessment_responses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `attempt_id` BIGINT UNSIGNED NOT NULL,
  `question_id` BIGINT UNSIGNED NOT NULL,
  `response_json` JSON NULL,
  `is_correct` TINYINT(1) NULL,
  `points_awarded` DECIMAL(8,2) NULL,
  `graded_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `assessment_responses_unique` (`attempt_id`, `question_id`),
  CONSTRAINT `assessment_responses_attempt_id_foreign`
    FOREIGN KEY (`attempt_id`) REFERENCES `assessment_attempts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assessment_responses_question_id_foreign`
    FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`),
  CONSTRAINT `assessment_responses_graded_by_foreign`
    FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Tutoring & attendance
-- -----------------------------------------------------------------------------

CREATE TABLE `tutor_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NULL,
  `bio_en` TEXT NULL,
  `bio_ar` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tutor_profiles_tenant_user_unique` (`tenant_id`, `user_id`),
  KEY `tutor_profiles_school_status_index` (`school_id`, `status`),
  CONSTRAINT `tutor_profiles_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutor_profiles_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `tutor_profiles_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutor_subjects` (
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NOT NULL,
  `languages_json` JSON NOT NULL,
  PRIMARY KEY (`tutor_profile_id`, `subject_id`),
  CONSTRAINT `tutor_subjects_tutor_profile_id_foreign`
    FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tutor_subjects_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutor_availabilities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `campus_id` BIGINT UNSIGNED NULL,
  `weekday` TINYINT UNSIGNED NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `slot_minutes` INT UNSIGNED NOT NULL DEFAULT 60,
  `timezone` VARCHAR(64) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `tutor_availabilities_tutor_weekday_index` (`tutor_profile_id`, `weekday`, `is_active`),
  CONSTRAINT `tutor_availabilities_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutor_availabilities_tutor_profile_id_foreign`
    FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`),
  CONSTRAINT `tutor_availabilities_campus_id_foreign`
    FOREIGN KEY (`campus_id`) REFERENCES `campuses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutor_availability_exceptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `exception_date` DATE NOT NULL,
  `is_available` TINYINT(1) NOT NULL,
  `start_time` TIME NULL,
  `end_time` TIME NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `tutor_availability_exceptions_tutor_date_index` (`tutor_profile_id`, `exception_date`),
  CONSTRAINT `tutor_availability_exceptions_tutor_profile_id_foreign`
    FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutoring_packages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `total_minutes` INT UNSIGNED NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `tutoring_packages_tenant_school_index` (`tenant_id`, `school_id`),
  CONSTRAINT `tutoring_packages_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutoring_packages_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_package_balances` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `tutoring_package_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `minutes_remaining` INT UNSIGNED NOT NULL,
  `expires_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `student_package_balances_student_expires_index` (`student_user_id`, `expires_at`),
  CONSTRAINT `student_package_balances_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `student_package_balances_package_id_foreign`
    FOREIGN KEY (`tutoring_package_id`) REFERENCES `tutoring_packages` (`id`),
  CONSTRAINT `student_package_balances_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutoring_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `campus_id` BIGINT UNSIGNED NULL,
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `subject_id` BIGINT UNSIGNED NOT NULL,
  `language` VARCHAR(10) NOT NULL,
  `session_type` VARCHAR(32) NOT NULL DEFAULT 'one_to_one',
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  `meeting_provider` VARCHAR(32) NULL,
  `meeting_url` VARCHAR(1000) NULL,
  `meeting_external_id` VARCHAR(191) NULL,
  `recording_url` VARCHAR(1000) NULL,
  `cancelled_at` DATETIME NULL,
  `cancel_reason` VARCHAR(500) NULL,
  `minutes_consumed` INT UNSIGNED NULL,
  `booked_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `tutoring_sessions_tenant_school_starts_index` (`tenant_id`, `school_id`, `starts_at`),
  KEY `tutoring_sessions_tutor_starts_status_index` (`tutor_profile_id`, `starts_at`, `status`),
  KEY `tutoring_sessions_status_starts_index` (`status`, `starts_at`),
  CONSTRAINT `tutoring_sessions_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutoring_sessions_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `tutoring_sessions_campus_id_foreign`
    FOREIGN KEY (`campus_id`) REFERENCES `campuses` (`id`),
  CONSTRAINT `tutoring_sessions_tutor_profile_id_foreign`
    FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`),
  CONSTRAINT `tutoring_sessions_subject_id_foreign`
    FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `tutoring_sessions_booked_by_foreign`
    FOREIGN KEY (`booked_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutoring_session_participants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tutoring_session_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'learner',
  PRIMARY KEY (`id`),
  UNIQUE KEY `tutoring_session_participants_unique` (`tutoring_session_id`, `student_user_id`),
  KEY `tutoring_session_participants_student_index` (`student_user_id`),
  CONSTRAINT `tutoring_session_participants_session_foreign`
    FOREIGN KEY (`tutoring_session_id`) REFERENCES `tutoring_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tutoring_session_participants_student_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tutoring_attendance` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `tutoring_session_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `marked_by` BIGINT UNSIGNED NULL,
  `marked_at` DATETIME NOT NULL,
  `notes` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tutoring_attendance_unique` (`tutoring_session_id`, `student_user_id`),
  KEY `tutoring_attendance_tenant_student_index` (`tenant_id`, `student_user_id`),
  KEY `tutoring_attendance_status_index` (`status`),
  CONSTRAINT `tutoring_attendance_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutoring_attendance_session_foreign`
    FOREIGN KEY (`tutoring_session_id`) REFERENCES `tutoring_sessions` (`id`),
  CONSTRAINT `tutoring_attendance_student_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `tutoring_attendance_marked_by_foreign`
    FOREIGN KEY (`marked_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `session_notes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tutoring_session_id` BIGINT UNSIGNED NOT NULL,
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `notes` TEXT NOT NULL,
  `follow_up` TEXT NULL,
  `visible_to_parent` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_notes_session_unique` (`tutoring_session_id`),
  CONSTRAINT `session_notes_session_foreign`
    FOREIGN KEY (`tutoring_session_id`) REFERENCES `tutoring_sessions` (`id`),
  CONSTRAINT `session_notes_tutor_foreign`
    FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Notifications, certificates, achievements, audit
-- -----------------------------------------------------------------------------

CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(255) NOT NULL,
  `notifiable_type` VARCHAR(255) NOT NULL,
  `notifiable_id` BIGINT UNSIGNED NOT NULL,
  `data` JSON NOT NULL,
  `read_at` DATETIME NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_tenant_notifiable_index` (`tenant_id`, `notifiable_type`, `notifiable_id`),
  KEY `notifications_read_at_index` (`read_at`),
  CONSTRAINT `notifications_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notification_preferences` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `channel` VARCHAR(32) NOT NULL,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_preferences_unique` (`user_id`, `event_type`, `channel`),
  CONSTRAINT `notification_preferences_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `notification_preferences_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mail_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `to_email` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `provider_message_id` VARCHAR(191) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `mail_logs_tenant_created_index` (`tenant_id`, `created_at`),
  KEY `mail_logs_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `certificates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `school_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_ar` VARCHAR(255) NOT NULL,
  `issued_at` DATETIME NOT NULL,
  `voided_at` DATETIME NULL,
  `pdf_path` VARCHAR(500) NULL,
  `verification_code` VARCHAR(64) NULL,
  `snapshot_json` JSON NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `certificates_verification_code_unique` (`verification_code`),
  KEY `certificates_tenant_school_student_index` (`tenant_id`, `school_id`, `student_user_id`),
  CONSTRAINT `certificates_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `certificates_school_id_foreign`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `certificates_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `achievements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `description_en` TEXT NULL,
  `description_ar` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `achievements_tenant_code_unique` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_achievements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `achievement_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `awarded_at` DATETIME NOT NULL,
  `meta_json` JSON NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_achievements_unique` (`achievement_id`, `student_user_id`),
  KEY `student_achievements_student_index` (`student_user_id`),
  CONSTRAINT `student_achievements_tenant_id_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `student_achievements_achievement_id_foreign`
    FOREIGN KEY (`achievement_id`) REFERENCES `achievements` (`id`),
  CONSTRAINT `student_achievements_student_user_id_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `actor_user_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `auditable_type` VARCHAR(255) NULL,
  `auditable_id` BIGINT UNSIGNED NULL,
  `properties` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_tenant_created_index` (`tenant_id`, `created_at`),
  KEY `audit_logs_actor_created_index` (`actor_user_id`, `created_at`),
  KEY `audit_logs_auditable_index` (`auditable_type`, `auditable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Minimal seeds
-- -----------------------------------------------------------------------------

INSERT INTO `countries`
  (`code`, `name_en`, `name_ar`, `default_locale`, `default_timezone`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'ar', 'Asia/Riyadh', 1, NOW(), NOW()),
  ('AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'en', 'Asia/Dubai', 1, NOW(), NOW());

INSERT INTO `roles`
  (`code`, `name_en`, `name_ar`, `portal`, `is_system`, `created_at`, `updated_at`)
VALUES
  ('super_admin', 'Super Admin', 'المشرف العام', 'control', 1, NOW(), NOW()),
  ('tenant_owner', 'Tenant Owner', 'مالك المستأجر', 'control', 1, NOW(), NOW()),
  ('school_admin', 'School Admin', 'مدير المدرسة', 'institution', 1, NOW(), NOW()),
  ('campus_admin', 'Campus Admin', 'مدير الحرم', 'institution', 1, NOW(), NOW()),
  ('academic_coordinator', 'Academic Coordinator', 'منسق أكاديمي', 'institution', 1, NOW(), NOW()),
  ('teacher', 'Teacher', 'معلم', 'institution', 1, NOW(), NOW()),
  ('tutor', 'Tutor', 'مدرس خصوصي', 'institution', 1, NOW(), NOW()),
  ('student', 'Student', 'طالب', 'learner', 1, NOW(), NOW()),
  ('parent', 'Parent', 'ولي أمر', 'learner', 1, NOW(), NOW());

INSERT INTO `subscription_plans`
  (`code`, `name_en`, `name_ar`, `price`, `currency`, `max_schools`, `max_campuses`, `max_students`, `max_teachers`, `max_storage_mb`, `modules_json`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('starter', 'Starter', 'أساسي', 0.00, 'SAR', 1, 1, 200, 20, 5120,
   JSON_OBJECT('tutoring', true, 'virtual_labs', false, 'advanced_reports', false), 1, NOW(), NOW()),
  ('growth', 'Growth', 'نمو', 0.00, 'SAR', 5, 10, 2000, 200, 51200,
   JSON_OBJECT('tutoring', true, 'virtual_labs', true, 'advanced_reports', true), 1, NOW(), NOW());

-- End of schema v1.0
