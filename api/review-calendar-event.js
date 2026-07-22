// Called when you click Approve/Reject on a pending calendar event in the UI.
// Body: { id: '<review_queue_row_id>', action: 'approve' | 'reject' }

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id, action } = req.body;

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
            let duration = null;
            if (row.start_time && row.end_time) {
                const start = new Date(row.start_time);
                const end = new Date(row.end_time);
                const diffMs = end - start;
                if (!isNaN(diffMs) && diffMs > 0) {
                    duration = Math.round(diffMs / 60000);
                }
            }

            // Reconstruct the Google Calendar event link the same way Google does:
            // base64("<event_id> <calendar_email>")
            const calendarEmail = process.env.GOOGLE_CALENDAR_EMAIL; // set this env var to your calendar's email
            const eid = Buffer.from(`${row.google_event_id} ${calendarEmail}`).toString('base64');
            const calendarEventLink = `https://www.google.com/calendar/event?eid=${eid}`;

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
                    date: row.start_time ? row.start_time.split('T')[0] : null,
                    time: row.start_time ? row.start_time.split('T')[1]?.slice(0, 5) : null, // "HH:MM" to match your existing "22:00" format
                    duration,
                    title: row.title,
                    summary: row.description || null,
                    calendar_added: true,
                    calendar_event_link: calendarEventLink
                    // calendar_event_id stays NULL, matching your existing rows
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