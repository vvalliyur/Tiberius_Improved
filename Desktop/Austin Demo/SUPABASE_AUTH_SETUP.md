# Supabase Authentication Setup Guide

## Step 1: Enable Email Authentication in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** in the left sidebar
3. Find **Email** in the list of providers
4. Click on **Email** to configure it
5. Enable **Email** authentication
6. (Optional) Configure email templates and settings
7. Click **Save**

## Step 2: Configure Email Settings (Optional but Recommended)

1. In **Authentication** → **Email Templates**, you can customize:
   - Confirmation email
   - Password reset email
   - Magic link email

2. For development, you can disable email confirmation:
   - Go to **Authentication** → **Settings**
   - Under **User Signups**, toggle **Enable email confirmations** OFF
   - This allows immediate sign-in without email verification (for testing only)

## Step 3: Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following:
   - **Project URL** (this is your `VITE_SUPABASE_URL`)
   - **anon/public key** (this is your `VITE_SUPABASE_ANON_KEY`)

## Step 4: Set Up Frontend Environment Variables

1. In your `frontend` directory, create a `.env` file:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```
   VITE_API_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## Step 5: Create a Test User

### Option A: Using the Supabase Dashboard

1. Go to **Authentication** → **Users** in your Supabase dashboard
2. Click **Add user** → **Create new user**
3. Enter:
   - **Email**: `test@example.com` (or any email)
   - **Password**: Choose a secure password (minimum 6 characters)
   - **Auto Confirm User**: ✅ (check this to skip email confirmation)
4. Click **Create user**

### Option B: Using the Frontend Sign-Up Form

1. Start your frontend: `npm run dev`
2. Navigate to the login page
3. Click "Don't have an account? Sign Up"
4. Enter your email and password
5. If email confirmation is disabled, you'll be logged in immediately
6. If email confirmation is enabled, check your email and click the confirmation link

### Option C: Using SQL (Advanced)

Run this SQL in your Supabase SQL Editor:

```sql
-- Create a test user (password: test123456)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@example.com',
  crypt('test123456', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  FALSE,
  '',
  '',
  '',
  ''
);

-- Get the user ID from the insert above, then run:
-- INSERT INTO auth.identities (id, user_id, identity_data, provider, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   'USER_ID_FROM_ABOVE',
--   '{"sub":"USER_ID_FROM_ABOVE","email":"test@example.com"}',
--   'email',
--   NOW(),
--   NOW()
-- );
```

## Step 6: Test Authentication

1. Start your backend:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. Start your frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Navigate to `http://localhost:5173` (or your Vite port)
4. You should see the login page
5. Sign in with your test user credentials
6. After successful login, you should see the main dashboard

## Troubleshooting

### "Invalid API key" error
- Make sure your `VITE_SUPABASE_ANON_KEY` is correct
- Check that you're using the **anon/public** key, not the service role key

### "Email not confirmed" error
- Disable email confirmation in Supabase settings (for development)
- Or check your email and click the confirmation link

### "Invalid login credentials"
- Make sure the user exists in Supabase
- Check that the password is correct
- Verify email confirmation if it's enabled

### CORS errors
- Make sure your backend CORS settings allow your frontend URL
- Check that `VITE_API_URL` matches your backend URL

## Security Notes

- **Never commit your `.env` file** to version control
- The `.env` file is already in `.gitignore`
- For production, use environment variables in your hosting platform
- The `anon` key is safe to use in frontend code (it's public)
- Never expose your `service_role` key in frontend code

