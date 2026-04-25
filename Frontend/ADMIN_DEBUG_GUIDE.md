# Admin Panel Redirect Issue - Debugging Guide 🔧

## 🚨 **Problem**
Admin panel redirects to login page even after successful authentication.

## 🔍 **Debugging Steps Added**

I've added comprehensive logging to track the authentication flow:

### **1. Auth Context Debugging**
Open browser console and look for these logs:
- `[AuthContext] Attempting login with: [email]`
- `[AuthContext] Login response: [response data]`
- `[AuthContext] Token set: [token]`
- `[AuthContext] User set: [user data]`
- `[AuthContext] User stored in localStorage`

### **2. Dashboard Layout Debugging**
Look for these logs when accessing admin panel:
- `[DashboardLayout] User state: [user object or null]`
- `[DashboardLayout] Loading state: [true/false]`
- `[DashboardLayout] RequireAdmin: [true/false]`
- `[DashboardLayout] Pathname: [current path]`

### **3. Page Load Debugging**
- `[AuthContext] Stored user: [localStorage data]`
- `[AuthContext] Stored token: [token from localStorage]`
- `[AuthContext] Parsed user: [parsed user object]`

## 🧪 **Test Process**

### **Step 1: Fresh Login Test**
1. Clear browser storage:
   ```javascript
   localStorage.clear();
   ```

2. Navigate to `http://localhost:3000/login`

3. Login with admin credentials:
   - Email: `admin@lifescienceai.com.au`
   - Password: `password123`

4. Check console logs for successful login flow

### **Step 2: Admin Panel Test**
1. Navigate to `http://localhost:3000/admin/dashboard`

2. Check console logs to see:
   - If user state is loaded correctly
   - If authentication check passes
   - Where the redirect is happening

## 🔧 **Common Issues & Solutions**

### **Issue 1: Token Not Persisting**
**Symptoms:** `[AuthContext] Token set:` shows token, but `[AuthContext] Stored token:` is null on reload
**Solution:** Check `getAccessToken()` function in `lib/api.ts`

### **Issue 2: User State Lost**
**Symptoms:** `[AuthContext] User set:` shows user, but `[DashboardLayout] User state:` is null
**Solution:** React context issue - check component wrapping

### **Issue 3: Race Condition**
**Symptoms:** Loading state causes premature redirect
**Solution:** The `useEffect` dependencies might cause issues

## 🎯 **Expected Console Output**

**Successful Login Should Show:**
```
[AuthContext] Attempting login with: admin@lifescienceai.com.au
[AuthContext] Login response: {access: "mock-admin-token", user: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}}
[AuthContext] Token set: mock-admin-token
[AuthContext] User set: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}
[AuthContext] User stored in localStorage
```

**Admin Panel Access Should Show:**
```
[AuthContext] Stored user: {"id":"admin-uuid-1","email":"admin@lifescienceai.com.au","role":"admin",...}
[AuthContext] Stored token: mock-admin-token
[AuthContext] Parsed user: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}
[DashboardLayout] User state: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}
[DashboardLayout] Loading state: false
[DashboardLayout] RequireAdmin: true
[DashboardLayout] Pathname: /admin/dashboard
```

## 🚀 **Quick Fix Test**

If you're still getting redirected, try this temporary fix:

```javascript
// In browser console after successful login
localStorage.setItem('access_token', 'mock-admin-token');
localStorage.setItem('user', JSON.stringify({
  id: 'admin-uuid-1',
  email: 'admin@lifescienceai.com.au',
  role: 'admin',
  is_verified: true,
  is_active: true
}));
```

Then navigate to `/admin/dashboard` and see if it works.

## 📋 **Report Back**

Please run through the test steps and share:
1. What console logs you see during login
2. What console logs you see when accessing admin panel
3. Whether the manual localStorage fix works
4. Any error messages in the console

This will help identify exactly where the authentication flow is breaking!
