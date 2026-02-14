# 🕷️ W3Spiders Scraping Ecosystem - Complete Guide

> **One System, Two Engines.** 
> Seamlessly switch between the official **Google Places API** (Paid/Fast) and the **Free Docker Scraper** (Free/Slow/Bulk).

---

## 📖 Table of Contents
1. [System Overview](#-system-overview)
2. [Quick Start API](#-quick-start)
3. [Configuration & Settings](#-configuration)
4. [Provider: Google Places API (V1)](#-provider-google-places-api-v1)
5. [Provider: Docker Scraper](#-provider-docker-scraper)
6. [API Reference (Detailed)](#-api-reference)
7. [Billing & Cost Management](#-billing--cost-management)
8. [Troubleshooting](#-troubleshooting)

---

## 🧠 System Overview

This backend implements a **Smart Hybrid Architecture**:
*   **Controller**: `ScraperService` acts as the dispatcher.
*   **Primary Engine**: **Google Places API**. Used for high-quality, verified data (Phones, Websites).
*   **Secondary Engine**: **Headless Scraper**. Used for bulk data or when API limits are reached.
*   **Safety Net**: The system tracks your daily API usage. If you hit your limit (e.g., 50 requests), it **automatically falls back** to the Free Scraper to ensure your business operations never stop.

---

## ⚡ Quick Start

### 1. The "Verified Lead" Job (Google API)
Get phone numbers and websites for a specific niche. 
*   **Cost**: ~$0.035 / request.
*   **Speed**: Instant (~2s).
```bash
curl -X POST http://localhost:5000/admin/scrape/start \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["Marketing Agencies in New York"],
    "provider": "google_places",
    "fields_level": "contact",
    "max_pages": 1
  }'
```

### 2. The "Bulk List" Job (Free Scraper)
Get a large list of businesses to filter later.
*   **Cost**: Free.
*   **Speed**: Slow (Scrolls page).
```bash
curl -X POST http://localhost:5000/admin/scrape/start \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["Marketing Agencies in New York"],
    "provider": "scraper",
    "max_results": 200
  }'
```

---

## � Configuration

Global settings are stored in your MongoDB `Settings` collection under the key `global`.

### Settings Object Structure
```javascript
{
  "key": "global",
  "data_provider": "google_places", // Default provider if none specified in API
  "google_places_config": {
    "enabled": true,
    "api_key": "YOUR_GCP_API_KEY",
    
    // SAFETY LIMITS
    "daily_limit": 50,          // Max Requests per day (Re-sets at midnight)
    "calls_today": 14,          // Usage counter (Auto-updates)
    
    // AUTOMATION
    "fallback_to_scraper": true,// If true, switches to Docker when limit hit
    "default_max_pages": 1,     // Default pagination depth (1 page = 20 results)
    
    // DATA COST LEVEL
    "fields_level": "contact"   // 'basic', 'contact', or 'atmosphere'
  }
}
```

---

## 🟢 Provider: Google Places API (V1)

Uses the official **Values (New)** API logic.

### Capabilities
*   **Fields**: Supports dynamic Field Masks to control costs.
*   **Pagination**: Can fetch up to **3 Pages** per query (~60 results).
*   **Billing**: Charges **PER REQUEST**. (Page 1 = 1 Req, Page 2 = 1 Req).

### Data Levels (`fields_level`)
| Level | Cost (Approx) | Fields Included | Recommended For |
| :--- | :--- | :--- | :--- |
| `basic` | ~$17 / 1,000 | Name, Address, Location, Photos, Types | Simple Mapping |
| `contact` | ~$35 / 1,000 | **+ Phone, Website**, Business Status | **Lead Generation** |
| `atmosphere`| High | **+ Ratings, Reviews**, Price Level, Hours | Deep Analysis |

---

## 🟡 Provider: Docker Scraper

Uses a Puppeteer/Playwright-based container to browse Google Maps visually.

### Capabilities
*   **Unlimited Browsing**: Can scroll indefinitely (control via `max_results`).
*   **Emails**: Can visit websites to extract emails (if `email_extraction: true` is set in code).
*   **Free**: No API costs, uses local resources (RAM/CPU).

---

## 📡 API Reference

### `POST /admin/scrape/start`

#### Parameters
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `queries` | `Array<String>` | Yes | List of search queries. |
| `provider` | `String` | No | `"google_places"` or `"scraper"`. Overrides global default. |
| `fields_level` | `String` | No | `"basic"`, `"contact"`, `"atmosphere"`. (Google Only) |
| `max_pages` | `Number` | No | `1` to `3`. How many pages to fetch. (Google Only) |
| `max_results` | `Number` | No | Target number of results for the scraper to scroll for. (Scraper Only) |

---

## 💰 Billing & Cost Management

The system is designed around the **Google Maps Platform Free Tier** ($200/month credit).

### Safe Limits Calculation
*   **Goal**: Stay 100% Free.
*   **Budget**: $200.00 / Month.
*   **Cost Per Request ("Contact" Level)**: $0.035.
*   **Math**: $200 / $0.035 ≈ **5,700 Requests / Month**.
*   **Daily Safety Limit**: 5,700 / 30 ≈ **190 Requests / Day**.

> **Our Default**: We set `daily_limit: 50` to be extremely conservative. This allows you to run verified jobs daily without worry, while the rest of your volume goes to the free scraper.

### Pagination Warning
If you set `"max_pages": 3`:
1.  **Query**: "Pizza" -> Page 1 (20 results) -> **$0.035**.
2.  Next -> Page 2 (20 results) -> **$0.035**.
3.  Next -> Page 3 (20 results) -> **$0.035**.
**Total**: ~$0.10 for one query of 60 results.
*The system checks your limit BEFORE each page fetch.*

---

## 🔧 Troubleshooting

### "Daily Limit Reached"
*   **Cause**: You have made >50 (or your configured limit) requests today.
*   **Behavior**: System stops using API.
*   **Fix**: 
    1. Wait for midnight (UTC) for auto-reset.
    2. Or, manually update MongoDB `settings.google_places_config.daily_limit` to a higher number.
    3. Or, manually set `calls_today` to 0.

### "Fallback to Scraper"
*   **Cause**: API limit was reached, and `fallback_to_scraper` is `true`.
*   **Result**: The job continues, but using the slower Docker scraper. Data might look slightly different (no verified `place_id` from Google).

### "No API Key"
*   **Cause**: `api_key` is missing in Settings.
*   **Fix**: Add your Google Maps API Key to the `Settings` collection.
