# 🚀 Quick Start - YayeTech Hotel Mobile App

## Prerequisites
- **Node.js 18+** installed
- **pnpm 9.0+** installed (`npm install -g pnpm`)
- **Expo Go** app on your phone (for testing)
- **or** iOS Simulator / Android Emulator

---

## 1️⃣ Install Dependencies

```bash
cd /home/kbdebain/Music/HOTEL_SYSTEM/hotel_system/apps/mobile
pnpm install
```

---

## 2️⃣ Run Development Server

### Run on Simulator/Emulator (Recommended)
```bash
# Start Expo dev server
pnpm start

# Then press:
# - **a** for Android
# - **i** for iOS
# - **w** for Web
```

### Run on Real Device
1. Download **Expo Go** from App Store or Play Store
2. Scan the QR code shown in terminal
3. App will launch and talk to your development server

### Run via Specific Platform
```bash
# Android
pnpm android

# iOS
pnpm ios

# Web
pnpm web
```

---

## 3️⃣ Access Backend API

The app connects to your backend API. Set the API URL in `eas.json`:

- **Development** (local backend): `http://localhost:3001`
- **Staging**: `https://api-staging.yayetech.com`
- **Production**: `https://api.yayetech.com`

---

## 4️⃣ Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm start` | Start development server (CORS enabled) |
| `pnpm android` | Ope in Android Emulator |
| `pnpm ios` | Open in iOS Simulator |
| `pnpm web` | Open in browser |
| `pnpm check-types` - TypeScript type check |
| `pnpm test` - Run unit tests |
| `pnpm test:watch` - Run tests in watch mode |

---

## 5️⃣ Verify Setup

After running, check:

1. ✅ **Metro bundler** is running (terminal shows "Metro waiting on exp://...")
2. ✅ **QR code** is displayed - scan it with Expo Go
3. ✅ **Bundling status**: `Bundled!` in terminal ✅

---

## 6️⃣ Login Credentials

Test user credentials (from `apps/api/prisma/seed.ts`):
- **Admin**: `admin@yayetech.com` / `AdminPass123!`
- **Manager**: `manager@yayetech.com` / `ManagerPass123!`
- **Staff**: `staff@yayetech.com` / `StaffPass123!`
- **Customer**: `customer@yayetech.com` / `CustomerPass123!`

---

## 7️⃣ Troubleshooting

### "Module not found" errors
```bash
rm -rf node_modules
pnpm install
```

### Metro bundler won't start
```bash
# Clear cache and restart
pkill -f "expo"
cd /home/kbdebain/Music/HOTEL_SYSTEM/hotel_system/apps/mobile
pnpm start --clear
```

### CORS errors with backend
Make sure your backend allows requests:
- Origin: `http://localhost:8081` or your emulator IP
- Authorization: Your app will send Bearer token

---

## 🎯 First Steps in App

1. **Sign up** - Create a new account
2. **Search** - Look up hotels in your city
3. **Book** - Complete the booking flow
4. **Dashboard** - View stats & shared layouts
5. **Try Admin/Manager** - Toggle user role in profile

---

## 📞 Getting Help

- Expo docs: https://docs.expo.dev
- React Navigation: https://reactnavigation.org
- TanStack Query: https://tanstack.com/query/latest

---

**Ready to run!** 🎉

```bash
cd /home/kbdebain/Music/HOTEL_SYSTEM/hotel_system/apps/mobile
pnpm start
```

Scan QR code with **Expo Go** and you're ready! 📱