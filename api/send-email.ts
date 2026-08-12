import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { to, subject, bodyText, userAccessToken } = body || {};

        if (!userAccessToken) {
            return res.status(401).json({
                error: 'Unauthorized',
                details: 'Missing Google access token. Please log in again.'
            });
        }

        const emailLines = [
            `To: ${Array.isArray(to) ? to.join(', ') : to}`,
            `Subject: ${subject}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            bodyText || ''
        ];

        const rawEmail = Buffer.from(emailLines.join('\r\n'))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: rawEmail }),
        });

        const data = await gmailResponse.json();

        if (!gmailResponse.ok) {
            return res.status(gmailResponse.status).json({
                error: 'Gmail API Error',
                details: data.error?.message || 'Failed to send email from user inbox'
            });
        }

        return res.status(200).json({ success: true, messageId: data.id });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}