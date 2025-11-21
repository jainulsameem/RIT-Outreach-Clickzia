import { supabase } from './_utils/supabaseClient.js';
import { fetchLeadDetails, normalizeLeadData } from './_utils/facebook.js';

/**
 * Serverless Function Handler
 * Endpoint: /api/facebook-webhook
 */
export default async function handler(req, res) {
  const { method } = req;

  // 1. Verification Request (GET)
  if (method === 'GET') {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
          console.log('WEBHOOK_VERIFIED');
          return res.status(200).send(challenge);
        } else {
          return res.status(403).send('Forbidden');
        }
      } else {
        return res.status(400).send('Missing parameters');
      }
    } catch (error) {
      return res.status(500).send('Server Error');
    }
  }

  // 2. Event Notification (POST)
  if (method === 'POST') {
    try {
      const body = req.body;

      if (body.object === 'page') {
        const processPromises = body.entry.map(async (entry) => {
          const pageId = entry.id;
          const changes = entry.changes || [];
          
          for (const change of changes) {
            if (change.field === 'leadgen') {
              const value = change.value;
              const leadgenId = value.leadgen_id;
              const formId = value.form_id;
              
              console.log(`[Processing] LeadGen ID: ${leadgenId}`);

              try {
                // A. Fetch from Facebook
                const leadDetails = await fetchLeadDetails(leadgenId);

                // B. Normalize
                const dbPayload = normalizeLeadData(leadDetails);
                dbPayload.page_id = pageId;
                dbPayload.form_id = formId;
                dbPayload.ad_id = value.ad_id || null;
                dbPayload.updated_at = new Date().toISOString();

                // C. Save to Supabase
                const { error } = await supabase
                  .from('leads')
                  .upsert(dbPayload, { onConflict: 'leadgen_id' });

                if (error) throw new Error(`Supabase Error: ${error.message}`);

                console.log(`[Success] Stored Lead: ${leadgenId}`);

              } catch (innerError) {
                console.error(`[Error] Failed processing lead ${leadgenId}:`, innerError.message);
                // We do NOT throw here to prevent one bad lead from crashing the whole batch
                // but in a strict system you might want to return 500 to force retry.
              }
            }
          }
        });

        await Promise.all(processPromises);
        return res.status(200).send('EVENT_RECEIVED');
      } else {
        return res.status(404).send('Not Found');
      }

    } catch (error) {
      console.error('[Fatal] Webhook processing failed:', error);
      return res.status(500).send('Internal Server Error');
    }
  }

  return res.status(405).end(`Method ${method} Not Allowed`);
}