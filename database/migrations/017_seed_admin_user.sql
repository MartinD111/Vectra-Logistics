-- Seed a default admin/admin login for local/dev use.
-- Password hash below is bcrypt('admin', 10 rounds).
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
VALUES ('admin@admin.com', '$2b$10$sX/9ozv9P8.PBXkMS6huZuK3KnRiLSpsTs7RPC0aPFAHzga0zVhzi', 'Admin', 'Admin', 'admin', TRUE)
ON CONFLICT (email) DO NOTHING;
