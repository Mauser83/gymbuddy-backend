import { Router } from 'express';

const router = Router();

router.get('/autocomplete', async (req, res) => {
  const input = req.query.input as string;
  if (!input) return res.status(400).json({ error: "Missing 'input' parameter" });

  try {
    const googleRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${process.env.GOOGLE_MAPS_API_KEY}&language=en`
    );
    const data = await googleRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Autocomplete proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch autocomplete data' });
  }
});

router.get('/place-details', async (req, res) => {
  const place_id = req.query.place_id as string;
  if (!place_id) return res.status(400).json({ error: "Missing 'place_id' parameter" });

  try {
    const googleRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = await googleRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Place details proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

export default router;
