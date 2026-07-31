-- Phase 12 — Live Tutoring ratings & feedback
USE `learning_platform`;

CREATE TABLE IF NOT EXISTS `tutoring_session_ratings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `tutoring_session_id` BIGINT UNSIGNED NOT NULL,
  `student_user_id` BIGINT UNSIGNED NOT NULL,
  `tutor_profile_id` BIGINT UNSIGNED NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `feedback` TEXT NULL,
  `feedback_ar` TEXT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `deleted_at` DATETIME NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tutoring_session_ratings_unique` (`tutoring_session_id`, `student_user_id`),
  KEY `tutoring_session_ratings_tutor_index` (`tutor_profile_id`, `rating`),
  CONSTRAINT `tutoring_session_ratings_tenant_foreign`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tutoring_session_ratings_session_foreign`
    FOREIGN KEY (`tutoring_session_id`) REFERENCES `tutoring_sessions` (`id`),
  CONSTRAINT `tutoring_session_ratings_student_foreign`
    FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `tutoring_session_ratings_tutor_foreign`
    FOREIGN KEY (`tutor_profile_id`) REFERENCES `tutor_profiles` (`id`),
  CONSTRAINT `tutoring_session_ratings_rating_check` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
