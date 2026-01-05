# How to Get Your Supabase JWT Secret

## Step-by-Step Instructions

1. **Go to your Supabase Dashboard**
   - Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sign in to your account

2. **Select Your Project**
   - Click on your project (the one with URL: `lmsrmiwyfrrhsdezijis.supabase.co`)

3. **Navigate to Settings**
   - Click on the **Settings** icon (gear icon) in the left sidebar
   - Or go directly to: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api`

4. **Find the JWT Secret**
   - Scroll down to the **"JWT Settings"** section
   - Look for **"JWT Secret"** (it's a long string, usually starts with something like `your-super-secret-jwt-token-with-at-least-32-characters-long`)
   - Click the **eye icon** or **"Reveal"** button to show the secret (it's hidden by default for security)

5. **Copy the JWT Secret**
   - Click the **copy icon** next to the JWT Secret
   - Or select and copy the entire secret string

6. **Add to Your Backend `.env` File**
   - Open `backend/.env` in your project
   - Add this line:
     ```
     SUPABASE_JWT_SECRET=your-copied-jwt-secret-here
     ```
   - Replace `your-copied-jwt-secret-here` with the actual secret you copied
   - Make sure there are no quotes around the value

## Visual Guide

The JWT Secret is located in:
```
Supabase Dashboard → Your Project → Settings → API → JWT Settings → JWT Secret
```

## Important Notes

- **JWT Secret vs Other Keys**: 
  - `SUPABASE_KEY` = "anon" key (public, safe to expose in frontend)
  - `SUPABASE_JWT_SECRET` = JWT Secret (private, only for backend)
  
- **Security**: Never commit your `.env` file to git! It should already be in `.gitignore`

- **After Adding**: Restart your backend server for the changes to take effect

## Alternative: Check JWT Signing Algorithm

While you're in the JWT Settings section, also check:
- **JWT Signing Algorithm**: Should be either `HS256` or `RS256`
  - If it's `HS256`: You MUST use `SUPABASE_JWT_SECRET` (this is what we're doing)
  - If it's `RS256`: You can use JWKS endpoint (but yours seems to be HS256 based on the 404 error)

## Troubleshooting

If you can't find the JWT Secret:
1. Make sure you're in the correct project
2. Check that you have admin/owner permissions for the project
3. Try refreshing the page
4. Look for "JWT Settings" or "Auth Settings" in the Settings menu

