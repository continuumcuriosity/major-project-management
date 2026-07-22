// Called when you click Approve/Reject on a pending calendar event in the UI.
// Body: { id, action: 'approve' | 'reject', date?, time?, duration? }
// date/time/duration (when provided) come from the browser, computed in the
// user's real local timezone — the server has no timezone context, so it
// must not try to derive wall-clock time from the raw UTC start_time itself.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, action, date, time, duration } = req.body;

  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Missing or invalid id/action' });
  }

  try {
    // Fetch the pending row
    const rowRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/calendar_review_queue?id=eq.${id}&select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
        }
      }
    );
    const rows = await rowRes.json();
    const row = rows[0];

    if (!row) {
      return res.status(404).json({ error: 'Review queue row not found' });
    }

    if (action === 'approve') {
      // Fall back to naive UTC-based values only if the browser didn't send them
      // (shouldn't normally happen — kept as a safety net, not the primary path)
      const finalDate = date || (row.start_time ? row.start_time.split('T')[0] : null);
      const finalTime = time || (row.start_time ? row.start_time.split('T')[1]?.slice(0, 5) : null);
      let finalDuration = duration;
      if (finalDuration == null && row.start_time && row.end_time) {
        const diffMs = new Date(row.end_time) - new Date(row.start_time);
        if (!isNaN(diffMs) && diffMs > 0) finalDuration = Math.round(diffMs / 60000);
      }

      // Reconstruct the Google Calendar event link the same way Google does:
      // base64("<event_id> <calendar_email>")
      let calendarEventLink = null;
      if (process.env.GOOGLE_CALENDAR_EMAIL) {
        const eid = Buffer.from(`${row.google_event_id} ${process.env.GOOGLE_CALENDAR_EMAIL}`).toString('base64');
        calendarEventLink = `https://www.google.com/calendar/event?eid=${eid}`;
      }

      const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/entries`, {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          type: 'session',
          date: finalDate,
          time: finalTime,
          duration: finalDuration,
          title: row.title,
          summary: row.description || null,
          calendar_added: true,
          calendar_event_link: calendarEventLink,
          // The REAL Google event ID — required so Unlink/Delete can later
          // call the Calendar API to remove this event. This was previously
          // (wrongly) left NULL, which silently broke calendar deletion.
          calendar_event_id: row.google_event_id
        })
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return res.status(500).json({ error: `Failed to insert into entries: ${errText}` });
      }
    }

    // Mark the review row as approved/rejected either way
    const updateRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/calendar_review_queue?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' })
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return res.status(500).json({ error: `Failed to update status: ${errText}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}