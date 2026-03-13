import { Response } from 'express';
import { db } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, phone, company_id, subscription, is_verified, avatar_url, two_factor_enabled, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { first_name, last_name, phone } = req.body;

    const result = await db.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name), 
           last_name = COALESCE($2, last_name), 
           phone = COALESCE($3, phone),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, first_name, last_name, role, phone, company_id, subscription, is_verified, avatar_url, two_factor_enabled, created_at`,
      [first_name, last_name, phone, userId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompany = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    
    if (!companyId) {
      return res.status(404).json({ error: 'No company associated with this user' });
    }

    const result = await db.query(
      `SELECT * FROM companies WHERE id = $1`,
      [companyId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.company_id;
    
    if (!companyId) {
      return res.status(403).json({ error: 'No company associated with this user' });
    }

    const { name, vat_number, address, city, country, postal_code } = req.body;

    const result = await db.query(
      `UPDATE companies 
       SET name = COALESCE($1, name), 
           vat_number = COALESCE($2, vat_number), 
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           country = COALESCE($5, country),
           postal_code = COALESCE($6, postal_code),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, vat_number, address, city, country, postal_code, companyId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const result = await db.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { email_notifications, whatsapp_notifications, notification_frequency, language, theme } = req.body;

    const result = await db.query(
      `UPDATE user_preferences 
       SET email_notifications = COALESCE($1, email_notifications), 
           whatsapp_notifications = COALESCE($2, whatsapp_notifications), 
           notification_frequency = COALESCE($3, notification_frequency),
           language = COALESCE($4, language),
           theme = COALESCE($5, theme),
           updated_at = NOW()
       WHERE user_id = $6
       RETURNING *`,
      [email_notifications, whatsapp_notifications, notification_frequency, language, theme, userId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
