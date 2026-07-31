-- Phase 7 RBAC schema additions for learning_platform
USE `learning_platform`;

ALTER TABLE `roles`
  ADD COLUMN `level` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `portal`,
  ADD COLUMN `parent_role_id` BIGINT UNSIGNED NULL AFTER `level`,
  ADD COLUMN `description_en` VARCHAR(255) NULL AFTER `parent_role_id`,
  ADD COLUMN `description_ar` VARCHAR(255) NULL AFTER `description_en`;

ALTER TABLE `roles`
  ADD CONSTRAINT `roles_parent_role_id_foreign`
    FOREIGN KEY (`parent_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL,
  `group_code` VARCHAR(64) NOT NULL,
  `name_en` VARCHAR(191) NOT NULL,
  `name_ar` VARCHAR(191) NOT NULL,
  `description_en` VARCHAR(255) NULL,
  `description_ar` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_code_unique` (`code`),
  KEY `permissions_group_code_index` (`group_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permission_role` (
  `permission_id` BIGINT UNSIGNED NOT NULL,
  `role_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`permission_id`, `role_id`),
  KEY `permission_role_role_id_index` (`role_id`),
  CONSTRAINT `permission_role_permission_id_foreign`
    FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `permission_role_role_id_foreign`
    FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
