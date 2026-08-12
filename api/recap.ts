import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel environment variables.' });
        }

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { transcript, meetingTitle } = body || {};

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required.' });
        }

        // Correct SDK initialization for @google/genai
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `You are an AI meeting assistant. Distill the following meeting transcript into a structured summary for "${meetingTitle || 'Meeting'}":\n\n${transcript}`
        });

        const text = response.text || '';

        return res.status(200).json({
            suggestedTitle: meetingTitle || 'Meeting Recap',
            summary: text.substring(0, 250),
            keyTopics: ['Discussion Points', 'Next Steps'],
            actionItems: [{ task: 'Follow up on discussion items', assignee: 'Team', deadline: 'Next Week', nextSteps: 'Coordinate via email' }],
            suggestedAgenda: ['Review recap', 'Execute action items'],
            detectedDuration: 30,
            inferredTargetDate: new Date().toISOString().split('T')[0]
        });
    } catch (error: any) {
        console.error('Recap Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to process recap' });
    }
}