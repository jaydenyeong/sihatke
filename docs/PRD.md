# Sihaty - Product Requirements Document

A privacy-first mobile app for elderly people (or individuals living alone) that allows simple daily health check-ins, while keeping family or trusted contacts informed without constant messaging.

## Product Concept

The app should:

- Prompt users at least once a day (can select how many times)
- Ask simple check-in questions:
  - physical health
  - mental state
- Use extremely simple UX (large buttons, minimal text, accessible design)
- Send a summarized status to trusted contacts
- Respect privacy (no continuous tracking, no invasive monitoring)

## Key Features

### 1. Daily Check-in System
- Tap-based response (e.g. thumbs up / not great / need help)
- Optional short note or voice input
- Missed check-in detection

### 2. Smart Alerts
- Notify family ONLY when:
  - User reports "need help"
  - Multiple check-ins missed
  - Pattern shows decline

### 3. Privacy-first Design
- No constant location tracking
- No raw data sharing unless necessary
- Summarized status only

### 4. Community Mode (optional)
- Nearby trusted people can offer help
- Lightweight request system ("need groceries" / "want to talk")

## Planning Tasks

### 1. System Architecture
- Frontend (mobile)
- Backend (API + database)
- Notification system
- Data model

### 2. Tech Stack
Optimized for:
- Fast solo development
- Low cost
- Scalability later

### 3. Core Database Schema
- Users
- Check-ins
- Contacts
- Alerts

### 4. API Endpoints

### 5. MVP Roadmap
- Week-by-week plan
- What to build first
- What to skip initially

### 6. UI/UX Patterns for Elderly Users
- Accessibility
- Simplicity
- Error prevention

### 7. Privacy & Security Considerations
- Data minimization
- Consent model
- Emergency override logic

### 8. Bonus
- 2-3 differentiating features that make this product stand out
- Monetization ideas (if any)

## Constraints

- Solo developer
- Prefer simple, maintainable architecture
- Avoid overengineering
- Prioritize shipping fast MVP
