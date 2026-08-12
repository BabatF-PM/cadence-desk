import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { transcript, attendees, meetingTitle, granularity } = req.body;

        if (!transcript || typeof transcript !== 'string') {
            return res.status(400).json({ error: 'Transcript is required.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel.' });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Call Gemini API logic here
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `Analyze this transcript for ${meetingTitle || 'Meeting'}: ${transcript}`,
        });

        return res.status(200).json({ result: response.text });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Recap failed' });
    }
}