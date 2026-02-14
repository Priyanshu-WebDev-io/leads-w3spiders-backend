# 🦅 The Filtration & Scoring System

## Overview
This system acts as an intelligent "Sales Analyst" that automatically processes every lead scraped from Google Maps or other sources. It cleans, verifies, and scores each business to help you prioritize who to call first.

## 🔄 The Pipeline
1.  **Ingestion**: Scraper/API saves raw data.
2.  **Normalization**: `DeduplicatorService` standardizes data (e.g., maps `price_level`, `business_status`).
3.  **Queueing**: Leads are added to `filtration-queue` (Redis).
4.  **Processing**: `FiltrationWorker` executes the `FilterEngine`.
5.  **Output**: Business record updated with `status`, `scoring`, and `priority`.

---

## 🛡️ Filtration Levels (The Gatekeepers)
*Filters determine if a lead is worth keeping. If a lead fails ANY filter, it is rejected.*

### Level 1: Validity Checks (Hard Stops)
1.  **ContactInfoFilter**:
    *   **Rule**: Must have at least ONE contact method (Phone, Email, or Website).
    *   **Logic**: This is your primary "DELETE" filter. No Contact = No Lead.
2.  **BusinessStatusFilter**:
    *   **Rule**: Must NOT be `CLOSED_PERMANENTLY`.
    *   **Logic**: Temporarily closed businesses are KEPT (might re-open).
3.  **CategoryExclusionFilter**:
    *   **Rule**: Must not be in blacklisted categories (e.g., 'atm', 'parking', 'church').

### Level 2: Quality Assurance (Scoring Only)
1.  **ReviewQualityFilter**:
    *   **Rule**: **NEVER DELETES**.
    *   **Logic**: If Rating < 3.5, the lead is KEPT but flagged as "Low Quality" and given a low score (10 points).
2.  **VisualsFilter**:
    *   **Rule**: **NEVER DELETES**.
    *   **Logic**: Use to boost score for visual businesses.

---

## 🏆 Scoring System (The Prioritizer)
*Scorers determine the "Value" of a lead (0-100).*

### 1. Pain Scorer (Weight: 35%) 🔥
*Measures how much they NEED your services.*
*   **+50 Points**: **NO WEBSITE** (The biggest opportunity).
*   **+30 Points**: Bad Reputation (High volume of reviews but < 4.0 rating).
*   **+25 Points**: Visual Business (Hotel/Food) with < 5 Photos.

### 2. Money Scorer (Weight: 30%) 💰
*Measures their ability to PAY.*
*   **+40 Points**: High `price_level` ($$$) or >1,000 Reviews.
*   **+25 Points**: High-value industry (Medical, Legal, Construction).
*   **+10 Points**: Already has a website (indicates digital budget).

### 3. Timing Scorer (Weight: 25%) ⏱️
*Measures URGENCY.*
*   **+40 Points**: **NEW BUSINESS** (Launched < 7 days ago).
*   **+30 Points**: Website is down/empty.

### 4. Reachability Scorer (Weight: 10%) 📞
*Measures ease of contact.*
*   **+50 Points**: Multiple Email Addresses.
*   **+20 Points**: Mobile Phone Number.

---

## 🥇 Priority Tiers
*The final "Badge" assigned to the lead.*

| Tier | Score | Description | Action |
| :--- | :--- | :--- | :--- |
| **PLATINUM** | **80+** | High Pain + High Budget | **CALL IMMEDIATELY** |
| **GOLD** | **60-79** | Strong Opportunity | Priority Outreach |
| **SILVER** | **40-59** | Moderate Opportunity | Nurture / Email |
| **BRONZE** | **20-39** | Low Prio / High Effort | Bulk Email Only |
| **SKIP** | **<20** | Not worth the effort | Archive |

---

## 🛠️ Configuration
You can adjust weights and thresholds in `backend/api/src/filters/index.js`.
Scorers are located in `backend/api/src/scorers/`.
