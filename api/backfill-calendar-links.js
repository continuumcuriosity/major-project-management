// ONE-TIME USE: visit this URL once in your browser to run it.
// Matches existing entries (that already have calendar_event_link but NO
// calendar_event_id) against Google's live event list by comparing htmlLink,
// and fills in the real Google event ID. Also cleans up any pending
// review-queue rows that turn out to be duplicates of already-synced sessions.
//
// Safe: only ever writes to entries.calendar_event_id and
// calendar_review_queue.status — never touches your session content.

export default async function handler(req, res) {
  try {
    // Step 1: get a fresh access token
    const tokenRes = await fetch(`https://${req.headers.host}/api/get-calendar-token`);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: tokenData.error || 'Failed to get access token' });
    }

    // Step 2: fetch a wide window of calendar events (last 365 days, adjust if needed)
    const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&singleEvents=true&maxResults=2500`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const calData = await calRes.json();
    const events = calData.items || [];

    // Build a lookup: htmlLink -> real event id
    const linkToId = new Map(events.map(ev => [ev.htmlLink, ev.id]));

    // Step 3: fetch entries that have a link but no id yet
    const entriesRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/entries?calendar_event_link=not.is.null&calendar_event_id=is.null&select=id,calendar_event_link`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY
        }
      }
    );
    const entriesToFix = await entriesRes.json();

    let updated = 0;
    const matchedEventIds = [];

    for (const entry of entriesToFix) {
      const realId = linkToId.get(entry.calendar_event_link);
      if (!realId) continue; // no match found in the fetched window, skip

      const patchRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/entries?id=eq.${entry.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: process.env.SUPABASE_SERVICE_KEY,
            Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ calendar_event_id: realId })
        }
      );
      if (patchRes.ok) {
        updated++;
        matchedEventIds.push(realId);
      }
    }

    // Step 4: clean up any pending review-queue rows that are now known duplicates
    let cleaned = 0;
    if (matchedEventIds.length > 0) {
      const idsFilter = matchedEventIds.map(id => `"${id}"`).join(',');
      const cleanupRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/calendar_review_queue?status=eq.pending&google_event_id=in.(${idsFilter})`,
        {
          method: 'PATCH',
          headers: {
            apikey: process.env.SUPABASE_SERVICE_KEY,
            Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ status: 'rejected' })
        }
      );
      if (cleanupRes.ok) {
        const cleanedRows = await cleanupRes.json();
        cleaned = cleanedRows.length;
      }
    }

    return res.status(200).json({
      ok: true,
      entries_checked: entriesToFix.length,
      entries_updated: updated,
      queue_rows_cleaned: cleaned
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}