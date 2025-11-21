
# Facebook Lead Ads Integration

## 1. Database Setup
Run the content of `supabase/schema.sql` in your Supabase SQL Editor.

## 2. Deployment
This project uses the `/api` directory structure compatible with Vercel Serverless Functions.

**Required Environment Variables (Server-Side):**
- `FB_VERIFY_TOKEN`: A random string you create (e.g. "leadexis_secret_123")
- `FB_PAGE_ACCESS_TOKEN`: Long-lived Page Access Token from Facebook Developer Portal (permissions: `leads_retrieval`, `pages_show_list`, `pages_manage_metadata`)
- `SUPABASE_URL`: Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (Found in Project Settings -> API -> Service Role). **Do NOT use the Anon key.**

## 3. Facebook Setup
1. Go to [developers.facebook.com](https://developers.facebook.com) -> My Apps -> Webhooks.
2. Select "Page" from the dropdown.
3. Click "Subscribe to this object".
4. **Callback URL:** `https://your-deployed-app.com/api/facebook-webhook`
   *(Note: This URL must be publicly accessible via HTTPS. Localhost won't work without ngrok)*
5. **Verify Token:** Enter the exact value you set for `FB_VERIFY_TOKEN`.
6. Click **Verify and Save**.
7. Scroll down to the `leadgen` field and click **Subscribe**.

## 4. Testing
- Use the [Facebook Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing).
- Select your Page and Form.
- Click "Create Lead".
- The lead should appear in your CRM Pipeline within a few seconds.
