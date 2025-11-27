
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
          
          // 1. Fetch Integration Config for this Page
          let pageConfig = null;
          try {
              const { data, error } = await supabase
                  .from('facebook_integrations')
                  .select('access_token, form_mappings, organization_id')
                  .eq('page_id', pageId)
                  .single();
              
              if (error || !data) {
                  console.warn(`[Warning] Received lead for Page ID ${pageId} but no integration found in DB.`);
                  return; 
              }
              pageConfig = data;
          } catch (err) {
              console.error("DB Error fetching integration:", err);
              return;
          }

          const { access_token: pageAccessToken, form_mappings: allFormMappings } = pageConfig;

          for (const change of changes) {
            if (change.field === 'leadgen') {
              const value = change.value;
              const leadgenId = value.leadgen_id;
              const formId = value.form_id;
              
              console.log(`[Processing] LeadGen ID: ${leadgenId} for Page: ${pageId}`);

              try {
                // 2. Fetch from Facebook using Page-Specific Token
                const leadDetails = await fetchLeadDetails(leadgenId, pageAccessToken);

                // 3. Get Specific Mappings for this Form (if any)
                const formSpecificMapping = allFormMappings?.[formId] || {};

                // 4. Normalize
                const dbPayload = normalizeLeadData(leadDetails, formSpecificMapping);
                dbPayload.page_id = pageId;
                dbPayload.form_id = formId;
                dbPayload.ad_id = value.ad_id || null;
                dbPayload.updated_at = new Date().toISOString();

                // 5. Save to Supabase
                const { error } = await supabase
                  .from('leads')
                  .upsert(dbPayload, { onConflict: 'leadgen_id' });

                if (error) throw new Error(`Supabase Error: ${error.message}`);

                console.log(`[Success] Stored Lead: ${leadgenId}`);

              } catch (innerError) {
                console.error(`[Error] Failed processing lead ${leadgenId}:`, innerError.message);
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
