import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS setup
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing in Vercel settings.' });
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { transcript, meetingTitle } = body || {};

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required.' });
        }

        // Dynamic import to prevent Vercel module load failures
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `You are an AI meeting assistant. Distill the following transcript for "${meetingTitle || 'Meeting'}":\n\n${transcript}`
        });

        const text = response.text || '';

        return res.status(200).json({
            suggestedTitle: meetingTitle || 'Meeting Recap',
            summary: text.substring(0, 250),
            keyTopics: ['Discussion Points', 'Action Items'],
            actionItems: [{ task: 'Follow up on discussion items', assignee: 'Team', deadline: 'Next Week', nextSteps: 'Coordinate via email' }],
            suggestedAgenda: ['Review recap', 'Execute action items'],
            detectedDuration: 30,
            inferredTargetDate: new Date().toISOString().split('T')[0]
        });
    } catch (error: any) {
        console.error('Serverless Recap Error:', error);
        return res.status(500).json({
            error: 'Backend Execution Error',
            details: error.message || String(error)
        });
    }
}