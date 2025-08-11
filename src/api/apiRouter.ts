import { Router } from 'express';

const apiRouter = Router();

// Ensure Node 18+ (global fetch). If not, uncomment next line:
// import fetch from 'node-fetch';

const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

if (!API_KEY) {
  // You can keep this, but don't throw here—surface a clear 500 on requests instead.
  console.warn('[apiRouter] Maps_API_KEY is not set. Google calls will fail.');
}

apiRouter.post('/autocomplete', async (req, res) => {
  try {
    const input = (req.body?.input ?? '').toString();
    if (!input) return res.status(400).json({ error: 'Missing input' });
    if (!API_KEY) return res.status(500).json({ error: 'Missing Maps_API_KEY' });

    const url = `${GOOGLE_PLACES_BASE}/places:autocomplete`;
    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({
        input,
        languageCode: 'en',
      }),
    });

    const text = await googleRes.text();
    if (!googleRes.ok) {
      console.error('Google autocomplete error:', googleRes.status, text);
      return res.status(googleRes.status).send(text);
    }

    // Pass-thru JSON so the client mapping stays simple
    return res.type('application/json').send(text);
  } catch (err) {
    console.error('Autocomplete proxy failed:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

apiRouter.get('/place-details', async (req, res) => {
  try {
    const place_id = (req.query.place_id ?? '').toString();
    if (!place_id) return res.status(400).json({ error: 'Missing place_id' });
    if (!API_KEY) return res.status(500).json({ error: 'Missing Maps_API_KEY' });

    const fieldMask = 'addressComponents,formattedAddress,location';
    const url = `${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(place_id)}`;

    const googleRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    const text = await googleRes.text();
    if (!googleRes.ok) {
      console.error('Google place details error:', googleRes.status, text);
      return res.status(googleRes.status).send(text);
    }

    // Pass-thru JSON; client expects formattedAddress + location
    return res.type('application/json').send(text);
  } catch (err) {
    console.error('Place details proxy failed:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default apiRouter;