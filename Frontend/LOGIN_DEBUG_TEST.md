# Login Debug Test - Step by Step 🔍

## 🧪 **Test This Now**

### **Step 1: Clear Everything**
Open browser console and run:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### **Step 2: Login Test**
1. Navigate to `http://localhost:3000/login`
2. Open browser console (F12)
3. Login with admin credentials:
   - Email: `admin@lifescienceai.com.au`
   - Password: `password123`

### **Step 3: Check Console Logs**
You should see these logs in order:

**1. Login Attempt:**
```
[AuthContext] Delegating to authApi.login...
```

**2. API Response:**
```
[useLogin] Login successful, user role: admin
[useLogin] User state updated in context: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}
```

**3. Navigation:**
```
[useLogin] Navigating to admin dashboard
```

**4. State Update:**
```
[AuthContext] setUser called with: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}
```

**5. Dashboard Layout:**
```
[DashboardLayout] User state: {id: "admin-uuid-1", email: "admin@lifescienceai.com.au", role: "admin", ...}
[DashboardLayout] Loading state: false
[DashboardLayout] RequireAdmin: true
[DashboardLayout] Pathname: /admin/dashboard
```

## 🔍 **If Still Not Working**

### **Check #1: API Response**
If you don't see the login success logs, check if the API call is working:
```javascript
// In browser console
fetch('/api/v1/auth/login/', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'admin@lifescienceai.com.au', password: 'password123'})
}).then(r => r.json()).then(console.log)
```

### **Check #2: Manual Navigation**
After successful login, try navigating manually:
```javascript
// In browser console after login
window.location.href = '/admin/dashboard';
```

### **Check #3: State Persistence**
Check if user is stored properly:
```javascript
// In browser console after login
console.log('User in localStorage:', localStorage.getItem('user'));
console.log('Token in localStorage:', localStorage.getItem('access_token'));
```

## 🚨 **Common Issues**

### **Issue 1: API Not Responding**
**Symptoms:** No login success logs
**Fix:** Check if `/api/v1/auth/login/` endpoint exists

### **Issue 2: State Not Updating**
**Symptoms:** Login success but no setUser logs
**Fix:** React context not updating properly

### **Issue 3: Navigation Not Working**
**Symptoms:** State updates but no navigation
**Fix:** Router not working, try manual navigation

## 📋 **Report Back**

Please run through these steps and tell me:
1. What console logs you see during login
2. Whether the manual API test works
3. Whether manual navigation works
4. What localStorage contains after login

This will help pinpoint exactly where the issue is!
