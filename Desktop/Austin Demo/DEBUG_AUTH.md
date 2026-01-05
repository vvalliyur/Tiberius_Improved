# Debugging 401 Unauthorized Error

## Step 1: Check if you're logged in

Open browser console (F12) and run:
```javascript
localStorage.getItem('supabase_token')
```

- If it returns `null` → You're not logged in. Sign in first.
- If it returns a token → Continue to Step 2

## Step 2: Check if token is being sent

1. Open Network tab in DevTools
2. Make a request to `/get_data`
3. Click on the request
4. Check "Headers" tab
5. Look for `Authorization: Bearer <token>`

If the Authorization header is missing:
- The token isn't being sent
- Check browser console for errors

## Step 3: Check backend logs

Look at your backend terminal for error messages. Common errors:
- "JWT validation not configured" → JWKS client failed to initialize
- "Invalid token" → Token format is wrong
- "Token has expired" → Need to refresh/login again

## Step 4: Verify Supabase Configuration

Make sure your backend `.env` has:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

## Step 5: Test Authentication Flow

1. **Sign in through the frontend**
2. **Check browser console** for any errors during login
3. **Verify token is stored**: `localStorage.getItem('supabase_token')`
4. **Try the request again**

## Common Issues:

### Issue: "JWT validation not configured"
**Solution**: Check that `SUPABASE_URL` is correct in backend `.env`

### Issue: Token not being sent
**Solution**: 
- Check that you're logged in
- Check browser console for errors
- Verify `localStorage.getItem('supabase_token')` returns a value

### Issue: "Invalid token"
**Solution**:
- Token might be expired - try logging out and back in
- Token format might be wrong - check it starts with `eyJ`

### Issue: Token exists but still getting 401
**Solution**:
- Check backend terminal for specific error
- Verify JWKS client initialized successfully
- Try refreshing the token by logging out and back in

