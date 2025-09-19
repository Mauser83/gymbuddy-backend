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

    const url = `${GOOGLE_PLACES_BASE}/places:autocomplete`;
    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({
        input,
        languageCode: 'en',
      }),
    });

    if (googleRes.ok === false) {
      const text = await googleRes.text();
      console.error('Google autocomplete error:', googleRes.status, text);
      return res.status(googleRes.status).send(text);
    }

    const data = await googleRes.json();
    return res.json(data);
  } catch (err) {
    console.error('Autocomplete proxy failed:', err);
    return res.status(500).json({ error: 'Failed to fetch autocomplete' });
  }
});

apiRouter.get('/autocomplete', async (req, res) => {
  try {
    const input = (req.query.input ?? '').toString();
    if (!input) return res.status(400).json({ error: 'Missing input' });

    const url = `${GOOGLE_PLACES_BASE}/places:autocomplete`;
    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({
        input,
        languageCode: 'en',
      }),
    });

    if (googleRes.ok === false) {
      const text = await googleRes.text();
      console.error('Google autocomplete error:', googleRes.status, text);
      return res.status(googleRes.status).send(text);
    }

    const data = await googleRes.json();
    return res.json(data);
  } catch (err) {
    console.error('Autocomplete proxy failed:', err);
    return res.status(500).json({ error: 'Failed to fetch autocomplete' });
  }
});

apiRouter.get('/place-details', async (req, res) => {
  try {
    const place_id = (req.query.place_id ?? '').toString();
    if (!place_id) return res.status(400).json({ error: 'Missing place_id' });

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

    if (googleRes.ok === false) {
      const text = await googleRes.text();
      console.error('Google place details error:', googleRes.status, text);
      return res.status(googleRes.status).send(text);
    }

    const data = await googleRes.json();
    return res.json(data);
  } catch (err) {
    console.error('Place details proxy failed:', err);
    return res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

export default apiRouter;
