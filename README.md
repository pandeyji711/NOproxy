# 📌 QR-Based Smart Attendance System

## 📖 Overview

This project is a **real-time, QR-based attendance system** built with **Node.js, Express, Socket.IO, and Google Sheets integration**.
It ensures secure and verifiable attendance by requiring students to:

* ✅ Scan a rotating QR code (refreshes every few seconds)
* ✅ Fill a form with **Name, Roll Number, Admission ID, Location, and Selfie**
* ✅ Stay in **fullscreen mode** (attendance is cancelled if they exit or minimize)
* ✅ Wait for teacher’s verification

Teachers (admins) can:

* 🖥️ Create a room and display the QR code
* 👩‍🏫 View live submissions (selfie, student details, location)
* ✅ Verify or reject attendance
* 📤 Sync verified data directly to **Google Sheets** with class name & date

---

## ⚡ Features

### 👨‍🎓 Student Side

* Scan QR to join attendance session
* Auto enter **fullscreen mode**
* If fullscreen is exited / app minimized → **attendance is cancelled**
* Submit **form with selfie + live location**
* Wait in verification screen until teacher approves

### 👩‍🏫 Teacher Side

* Create room & generate QR code (rotates every few seconds)
* View all student submissions in real-time
* See **selfie (not stored, only displayed)** + location + roll number
* Verify student → entry confirmed
* Export verified attendance data to **Excel or Google Sheets**

### 📊 Data Sync

* Attendance data (excluding selfies) can be exported to:

  * Excel (downloadable)
  * Google Sheets (teacher pastes sheet link, data synced with date & class name)

---

## 🏗️ Tech Stack

* **Frontend:** EJS, HTML, CSS, JavaScript
* **Backend:** Node.js, Express
* **Real-time:** Socket.IO
* **Storage/Export:** Excel (xlsx), Google Sheets API
* **Location Services:** HTML5 Geolocation + Reverse Geocoding
* **Camera Access:** HTML5 Media API

---

## 🚀 Setup Instructions

### 1️⃣ Clone the repo

```bash
git clone https://github.com/your-username/attendance-system.git
cd attendance-system
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Google Sheets Setup

1. Create a Google Cloud project
2. Enable **Google Sheets API**
3. Create a **Service Account** and download credentials JSON
4. Share your Google Sheet with the service account email
5. Place credentials in `config/credentials.json`

### 4️⃣ Run the server

```bash
npm start
```

### 5️⃣ Open in browser

```
http://localhost:3000
```

---

## 🔐 Security Features

* Attendance only valid with **QR + form + fullscreen**
* **Entry key** generated per student to prevent duplication
* Admin verified with JWT before room creation
* Local storage auto-cleared after submission

---

## 📸 Demo Flow

1. Teacher creates a room → QR displayed on screen
2. Student scans QR → form opens in fullscreen
3. Student submits selfie + location → goes to waiting room
4. Teacher verifies entry → attendance recorded
5. Data synced/exported to Google Sheet

---

