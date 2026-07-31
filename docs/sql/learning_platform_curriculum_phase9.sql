-- Phase 9 — Curriculum versioning enhancements
USE `learning_platform`;

ALTER TABLE `curricula`
  ADD COLUMN `published_at` DATETIME NULL AFTER `status`,
  ADD COLUMN `is_latest` TINYINT(1) NOT NULL DEFAULT 1 AFTER `published_at`,
  ADD COLUMN `change_summary_en` TEXT NULL AFTER `is_latest`,
  ADD COLUMN `change_summary_ar` TEXT NULL AFTER `change_summary_en`;

ALTER TABLE `subjects`
  DROP INDEX `subjects_school_code_unique`,
  ADD UNIQUE KEY `subjects_school_curriculum_code_unique` (`school_id`, `curriculum_id`, `code`);

ALTER TABLE `chapters`
  ADD COLUMN `curriculum_id` BIGINT UNSIGNED NULL AFTER `school_id`,
  ADD KEY `chapters_curriculum_id_index` (`curriculum_id`),
  ADD CONSTRAINT `chapters_curriculum_id_foreign`
    FOREIGN KEY (`curriculum_id`) REFERENCES `curricula` (`id`);

ALTER TABLE `curriculum_lessons`
  ADD COLUMN `curriculum_id` BIGINT UNSIGNED NULL AFTER `school_id`,
  ADD KEY `curriculum_lessons_curriculum_id_index` (`curriculum_id`),
  ADD CONSTRAINT `curriculum_lessons_curriculum_id_foreign`
    FOREIGN KEY (`curriculum_id`) REFERENCES `curricula` (`id`);

ALTER TABLE `learning_outcomes`
  ADD COLUMN `curriculum_id` BIGINT UNSIGNED NULL AFTER `school_id`,
  ADD KEY `learning_outcomes_curriculum_id_index` (`curriculum_id`),
  ADD CONSTRAINT `learning_outcomes_curriculum_id_foreign`
    FOREIGN KEY (`curriculum_id`) REFERENCES `curricula` (`id`),
  DROP INDEX `learning_outcomes_school_code_unique`,
  ADD UNIQUE KEY `learning_outcomes_school_curriculum_code_unique` (`school_id`, `curriculum_id`, `code`);

CREATE TABLE IF NOT EXISTS `curriculum_version_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL,
  `school_id` BIGINT UNSIGNED NULL,
  `curriculum_id` BIGINT UNSIGNED NOT NULL,
  `source_curriculum_id` BIGINT UNSIGNED NULL,
  `from_version` VARCHAR(32) NULL,
  `to_version` VARCHAR(32) NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `summary_en` TEXT NULL,
  `summary_ar` TEXT NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `curriculum_version_logs_curriculum_index` (`curriculum_id`),
  CONSTRAINT `curriculum_version_logs_curriculum_id_foreign`
    FOREIGN KEY (`curriculum_id`) REFERENCES `curricula` (`id`),
  CONSTRAINT `curriculum_version_logs_source_curriculum_id_foreign`
    FOREIGN KEY (`source_curriculum_id`) REFERENCES `curricula` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
