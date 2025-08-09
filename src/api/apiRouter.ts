import { Router } from 'express';

const router = Router();

// Autocomplete endpoint
router.post('/autocomplete', async (req, res) => {
  const { input } = req.body;
  if (!input) {
    return res.status(400).json({ error: "Missing 'input' in request body" });
  }

  const apiKey = process.env.Maps_API_KEY;
  
  // --- FIX START ---
  // Check if the API key is defined before using it
  if (!apiKey) {
    console.error('SERVER ERROR: Maps_API_KEY is not defined.');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  // --- FIX END ---

  const url = 'https://places.googleapis.com/v1/places:autocomplete';

  try {
    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TypeScript now knows apiKey is a string here
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({ input: input, languageCode: 'en' }),
    });

    const data = await googleRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Autocomplete proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch autocomplete data' });
  }
});

// Place Details endpoint
router.get('/place-details', async (req, res) => {
  const place_id = req.query.place_id as string;
  if (!place_id) {
    return res.status(400).json({ error: "Missing 'place_id' parameter" });
  }

  const apiKey = process.env.Maps_API_KEY;

  // --- FIX START ---
  // Perform the same check here
  if (!apiKey) {
    console.error('SERVER ERROR: Maps_API_KEY is not defined.');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  // --- FIX END ---

  const url = `https://places.googleapis.com/v1/places/${place_id}`;
  const fieldMask = 'places.addressComponents,places.formattedAddress,places.location';

  try {
    const googleRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // TypeScript now knows apiKey is a string here too
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    const data = await googleRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Place details proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

export default router;