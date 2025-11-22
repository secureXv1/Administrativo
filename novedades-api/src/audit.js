// src/audit.js
import { pool } from './db.js';

export const Actions = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  ACCOUNT_LOCK: 'ACCOUNT_LOCK',
  ACCOUNT_HARD_LOCK: 'ACCOUNT_HARD_LOCK',
  ACCOUNT_UNLOCK: 'ACCOUNT_UNLOCK',
  REPORT_CREATE: 'REPORT_CREATE',
  REPORT_UPDATE: 'REPORT_UPDATE',
  EXCEL_DOWNLOAD: 'EXCEL_DOWNLOAD',
  USER_CREATE: 'USER_CREATE',
  USER_PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE',
  AGENT_CREATE: 'AGENT_CREATE',
  AGENT_UPDATE: 'AGENT_UPDATE',
  GROUP_CREATE: 'GROUP_CREATE',
  UNIT_CREATE: 'UNIT_CREATE',
  AGENT_ASSIGN: 'AGENT_ASSIGN',   
  AGENT_RELEASE: 'AGENT_RELEASE', 
  REST_PLAN_SAVE: 'REST_PLAN_SAVE',
 
  
};

// Guarda un evento de auditoría
export async function logEvent({ req, userId = null, action, details = {} }) {
  try {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const ua = req.headers['user-agent'] || null;
    const detailsStr = JSON.stringify(details || {});
    await pool.query(
      'INSERT INTO event_log (userId, action, details, ip, user_agent) VALUES (?,?,?,?,?)',
      [userId, action, detailsStr, ip, ua]
    );
  } catch (e) {
    // No interrumpir el flujo de la app por un fallo de log
    console.error('[audit] logEvent error:', e.message);
  }
}
