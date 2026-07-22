// Manually triggered from the app: "Check for new events" button.
// Pulls recent events from Google Calendar, skips ones already known,
// and drops new ones into calendar_review_queue as 'pending' for you to approve/reject.

export default async function handler(req, res) {
  try {
    // Step 1: get a fresh access token (reuse your existing helper logic)
    const tokenRes = await fetch(`https://${req.headers.host}/api/get-calendar-token`);
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(400).json({ error: tokenData.error || 'Failed to get access token' });
    }

    // Step 2: fetch events from the last 30 days onward (adjust window as needed)
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }
    );
    const calData = await calRes.json();

    if (!calData.items) {
      return res.status(200).json({ ok: true, added: 0, message: 'No events found' });
    }

    // Step 3: check which google_event_ids we already have (any status)
    const existingRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/calendar_review_queue?select=google_event_id`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
        }
      }
    );
    const existingRows = await existingRes.json();
    const existingIds = new Set(existingRows.map(r => r.google_event_id));

    // Step 4: filter to genuinely new events only
    const newEvents = calData.items.filter(ev => ev.id && !existingIds.has(ev.id));

    if (newEvents.length === 0) {
      return res.status(200).json({ ok: true, added: 0, message: 'No new events' });
    }

    // Step 5: insert new ones as pending
    const rows = newEvents.map(ev => ({
      google_event_id: ev.id,
      title: ev.summary || '(no title)',
      start_time: ev.start?.dateTime || ev.start?.date || null,
      end_time: ev.end?.dateTime || ev.end?.date || null,
      description: ev.description || null,
      status: 'pending'
    }));

    const insertRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/calendar_review_queue`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(rows)
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return res.status(500).json({ ok: false, error: errText });
    }

    return res.status(200).json({ ok: true, added: rows.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}