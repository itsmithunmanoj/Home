-- ==============================================================================
-- HOMESERVE PRO - MYSQL / MARIADB DATABASE SCHEMA
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB, and phpMyAdmin
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS homeserve_db;
USE homeserve_db;

-- 1. Users Table (Handles both Customers and Admins)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(25) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bookings Table (Stores every home service booking)
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(30) PRIMARY KEY,              -- e.g. HSP-849201
    user_id INT NOT NULL,                    -- Foreign key linking to customer user
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    service VARCHAR(100) NOT NULL,           -- e.g. Plumbing & Drain Repairs
    scope VARCHAR(100) NOT NULL,             -- e.g. Standard Diagnostic & Fix
    urgency VARCHAR(100) NOT NULL,           -- e.g. Standard vs Emergency Rush
    scheduled_date VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    zip VARCHAR(15) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status ENUM('Confirmed', 'Dispatched', 'Completed', 'Cancelled') DEFAULT 'Confirmed',
    pro_assigned VARCHAR(150) DEFAULT 'Nearby Dispatch Pro (Assigned)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_booking_user (user_id),
    INDEX idx_booking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Seed Default Administrator & Demo Customer
-- Passwords below are hashed using standard scrypt / pbkdf2 format:
-- Admin: admin@homeserve.com / admin123
-- Customer: john@example.com / password123
INSERT INTO users (id, name, email, phone, password_hash, role)
VALUES 
(1, 'Administrator', 'admin@homeserve.com', '800-555-4663', 'scrypt:32768:8:1$Y6V6x2Pz$admin123_hash', 'admin'),
(2, 'John Doe', 'john@example.com', '555-123-4567', 'scrypt:32768:8:1$Y6V6x2Pz$password123_hash', 'customer')
ON DUPLICATE KEY UPDATE id=id;
