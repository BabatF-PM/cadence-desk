import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, threadTitle, inviterEmail } = req.body;

  if (!to || !threadTitle) {
    return res.status(400).json({ error: 'Missing required parameters (to, threadTitle)' });
  }

  // System Transactional Transporter (cadencedesk@gmail.com)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SYSTEM_EMAIL || 'cadencedesk@gmail.com',
      pass: process.env.SYSTEM_EMAIL_APP_PASSWORD, // 16-character Google App Password
    },
  });

  const inviter = inviterEmail || 'A team collaborator';
  const mailOptions = {
    from: `"Cadence Desk" <${process.env.SYSTEM_EMAIL || 'cadencedesk@gmail.com'}>`,
    to: to,
    subject: `[Cadence Desk] You've been invited to collaborate on "${threadTitle}"`,
    text: `Hello,\n\n${inviter} has added you as an authorized collaborator to the recurring meeting series "${threadTitle}" on Cadence Desk.\n\nYou can log in now to access past session summaries, check off action items, mark tasks as complete, and append new recaps.\n\n---\nCadence Desk • Enterprise AI Synchron`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin: 0 0 8px 0; font-size: 20px;">Cadence Desk Collaboration Invite</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Enterprise AI Synchron System Notification</p>
        </div>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">Hello,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">
          <strong>${inviter}</strong> has granted you collaborator access to the recurring meeting series:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <span style="font-size: 16px; font-weight: bold; color: #1e293b;">"${threadTitle}"</span>
        </div>
        <p style="font-size: 13px; color: #475569; font-weight: bold; margin-bottom: 6px;">As an authorized collaborator, you can:</p>
        <ul style="font-size: 13px; color: #475569; padding-left: 20px; line-height: 1.6; margin-top: 0;">
          <li>Review previous meeting session transcripts & AI recaps</li>
          <li>Track and toggle action items / task checklists</li>
          <li>Save and append new recurring session iterations</li>
        </ul>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">This is an automated notification from Cadence Desk • Enterprise AI Synchron.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('System email dispatch failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch email' });
  }
}