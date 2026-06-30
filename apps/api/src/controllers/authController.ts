import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
const JWT_EXPIRES_IN = '24h';

// Signup
export const signup = async (req: Request, res: Response) => {
  const client = await db.connect(); // use a transaction
  try {
    const { 
      email, password, first_name, last_name, role, phone,
      company_name, company_type, company_address, company_vat, company_city, company_country, company_postal_code
    } = req.body;

    // Validate inputs
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    let companyId = null;

    // Handle company creation for carriers and shippers
    if (role === 'carrier' || role === 'shipper') {
      if (!company_name) {
        throw new Error('Company name is required for carriers and shippers');
      }

      const companyResult = await client.query(
        `INSERT INTO companies (name, vat_number, address, city, country, postal_code, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
        [company_name, company_vat, company_address, company_city, company_country, company_postal_code]
      );
      companyId = companyResult.rows[0].id;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, phone, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, first_name, last_name, role, phone, companyId]
    );

    const newUser = userResult.rows[0];

    // Create default preferences
    await client.query(
      `INSERT INTO user_preferences (user_id) VALUES ($1)`,
      [newUser.id]
    );

    // Optional: Create email verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry
    
    await client.query(
      `INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES ($1, $2, 'email_verification', $3)`,
      [newUser.id, verificationToken, expiresAt]
    );

    await client.query('COMMIT');

    // Here we would normally send an email with the verification token

    res.status(201).json({ 
      message: 'User registered successfully',
      user: newUser 
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    client.release();
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // TODO: Handle 2FA check here if enabled

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        company_id: user.company_id,
        is_verified: user.is_verified 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove password hash from response
    delete user.password_hash;
    delete user.two_factor_secret;

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify Email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = await db.query(
      `SELECT * FROM auth_tokens WHERE token = $1 AND type = 'email_verification' AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const authToken = result.rows[0];

    await db.query('BEGIN');
    
    // Update user
    await db.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [authToken.user_id]);
    
    // Delete token
    await db.query(`DELETE FROM auth_tokens WHERE id = $1`, [authToken.id]);

    await db.query('COMMIT');

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forgot Password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const result = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (result.rows.length === 0) {
      // Don't leak whether the email exists
      return res.status(200).json({ message: 'If that email is registered, you will receive a reset link' });
    }

    const userId = result.rows[0].id;
    const resetToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 mins expiry

    // Delete any existing reset tokens for this user
    await db.query(`DELETE FROM auth_tokens WHERE user_id = $1 AND type = 'password_reset'`, [userId]);

    await db.query(
      `INSERT INTO auth_tokens (user_id, token, type, expires_at) VALUES ($1, $2, 'password_reset', $3)`,
      [userId, resetToken, expiresAt]
    );

    // Here we would normally send an email with the reset token link

    res.status(200).json({ message: 'If that email is registered, you will receive a reset link' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset Password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const result = await db.query(
      `SELECT * FROM auth_tokens WHERE token = $1 AND type = 'password_reset' AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const authToken = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query('BEGIN');
    
    // Update password
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, authToken.user_id]);
    
    // Delete token
    await db.query(`DELETE FROM auth_tokens WHERE id = $1`, [authToken.id]);

    await db.query('COMMIT');

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
