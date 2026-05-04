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
- One app, two roles. A user can be both sender and receiver
- Respect privacy (no continuous tracking, no invasive monitoring)

# Core User Flows
Sender flow — daily check-in (target: under 10 seconds):

Open app. Single screen with three large emoji-style buttons for physical state (😊 / 😐 / 😟) and three for mental state.
One tap each → optional one-line text for "anything I need help with today?"
One large "Send" button with confirmation text

Sender flow — initial setup (done once, ideally with help from a family member):

Phone number / OTP login.
Add receivers: each receiver gets an SMS/WhatsApp invite with a join code.
Configure reminder times.
Optional: add basic profile (age, languages, important conditions).

Receiver flow:

Receive push notification
Tap to open dashboard showing all linked seniors with status traffic-light (green/yellow/red).
View history per sender — chart of last 7/30 days.
Critical: a "missed check-in" alert if a sender skips an expected window. This is one of the highest-value features.
One-tap call or message back to the sender.


# Information Architecture
Three persistent tabs in the app:

Today (primary action surface)
Circle (people you're connected to)
Settings (reminders, language, account)

Receivers see their version of "Today" as the dashboard of all their linked seniors. Same shell, different content.




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
