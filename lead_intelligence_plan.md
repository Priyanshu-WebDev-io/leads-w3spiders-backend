# Lead Intelligence + Weakness Detection Engine
## Implementation Plan

> **Goal**: Automatically analyze each business lead to detect online weaknesses and generate ready-made sales talking points for your team.

---

## 📋 Executive Summary

This system transforms raw business data into **actionable sales intelligence** by:
- Automatically auditing websites, SEO, and Google Business Profiles
- Scoring leads based on detected weaknesses
- Generating human-readable sales insights
- Prioritizing leads (HOT/WARM/COLD)
- Providing ready-made pitch templates

**Timeline**: 3-4 weeks for MVP
**Complexity**: Medium-High
**ROI**: High (dramatically improves sales conversion)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│         Lead Ingestion (Existing)                   │
│  Google Places API / Scraper → Business Model       │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│         Event Queue (BullMQ)                        │
│  Triggers: lead.created, lead.updated               │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│         Analysis Workers (Parallel)                 │
│  ├─ Website Analyzer (Puppeteer + Lighthouse)      │
│  ├─ SEO Scanner (Cheerio + Google Index Check)     │
│  └─ GBP Analyzer (Places API Data)                 │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│         Weakness Scoring Engine                     │
│  Calculates lead score + priority + insights       │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│         Lead Intelligence Model (MongoDB)           │
│  Stores audit results + scores + talking points    │
└─────────────────┬───────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────┐
│         Sales Dashboard (Frontend)                  │
│  Displays prioritized leads with insights          │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Phase 1: Database Schema Design

### 1.1 Update Business Model

Add intelligence fields to existing [Business](file:///Users/priyanshu/Desktop/w3spiders-crm/backend/api/src/services/deduplicator.js#74-176) model:

```javascript
// New fields to add to Business schema
{
  // Intelligence metadata
  intelligence: {
    last_analyzed: Date,
    analysis_status: {
      type: String,
      enum: ['pending', 'analyzing', 'completed', 'failed'],
      default: 'pending'
    },
    next_analysis: Date, // For re-audit scheduling
  },
  
  // Lead scoring
  lead_score: {
    type: Number,
    min: 0,
    max: 100,
    index: true
  },
  
  priority: {
    type: String,
    enum: ['HOT', 'WARM', 'COLD', 'UNSCORED'],
    default: 'UNSCORED',
    index: true
  }
}
```

### 1.2 Create LeadIntelligence Model

New collection for detailed audit results:

```javascript
const LeadIntelligenceSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    unique: true,
    index: true
  },
  
  // Website Audit
  website_audit: {
    has_website: Boolean,
    url: String,
    mobile_score: Number,        // 0-100 (Lighthouse)
    speed_score: Number,         // 0-100 (Lighthouse)
    is_https: Boolean,
    has_whatsapp: Boolean,
    has_contact_form: Boolean,
    has_cta: Boolean,
    has_analytics: Boolean,
    detected_platform: String,   // WordPress, Wix, Custom, etc.
    last_checked: Date
  },
  
  // SEO Audit
  seo_audit: {
    is_indexed: Boolean,
    indexed_pages: Number,
    has_title: Boolean,
    title_length: Number,
    has_meta_description: Boolean,
    has_local_keywords: Boolean,
    has_schema_markup: Boolean,
    last_checked: Date
  },
  
  // Google Business Profile Audit
  gbp_audit: {
    rating: Number,
    review_count: Number,
    has_owner_replies: Boolean,
    reply_rate: Number,          // % of reviews with owner reply
    photo_count: Number,
    has_business_hours: Boolean,
    has_description: Boolean,
    is_verified: Boolean,
    last_checked: Date
  },
  
  // Weakness Detection
  weaknesses: [{
    type: {
      type: String,
      enum: [
        'NO_WEBSITE',
        'POOR_MOBILE',
        'SLOW_SPEED',
        'NO_HTTPS',
        'NO_LEAD_CAPTURE',
        'NO_WHATSAPP',
        'LOW_RATING',
        'LOW_REVIEWS',
        'NO_OWNER_REPLIES',
        'POOR_SEO',
        'NOT_INDEXED',
        'FEW_PHOTOS',
        'NO_ANALYTICS'
      ]
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    },
    score_impact: Number,        // How much this affects lead score
    detected_at: Date
  }],
  
  // Auto-Generated Sales Insights
  sales_insights: [{
    category: String,            // 'website', 'seo', 'gbp'
    message: String,             // Human-readable weakness
    pitch_template: String,      // Suggested sales pitch
    priority: Number             // Display order
  }],
  
  // Scoring breakdown
  scoring: {
    website_score: Number,
    seo_score: Number,
    gbp_score: Number,
    total_score: Number,
    calculated_at: Date
  },
  
  // Metadata
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});
```

### 1.3 Create AnalysisJob Model

Track background analysis jobs:

```javascript
const AnalysisJobSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  
  job_type: {
    type: String,
    enum: ['full_analysis', 'website_only', 'seo_only', 'gbp_only', 're_analysis'],
    required: true
  },
  
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued'
  },
  
  progress: {
    website: { type: String, enum: ['pending', 'running', 'done', 'failed'] },
    seo: { type: String, enum: ['pending', 'running', 'done', 'failed'] },
    gbp: { type: String, enum: ['pending', 'running', 'done', 'failed'] }
  },
  
  error: String,
  started_at: Date,
  completed_at: Date,
  
  created_at: { type: Date, default: Date.now }
});
```

---

## 🔧 Phase 2: Background Job System

### 2.1 Setup BullMQ

**Install dependencies:**
```bash
npm install bullmq ioredis
```

**Create queue configuration:**

```javascript
// src/queues/config.js
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

module.exports = { connection };
```

### 2.2 Create Analysis Queue

```javascript
// src/queues/analysisQueue.js
const { Queue } = require('bullmq');
const { connection } = require('./config');

const analysisQueue = new Queue('lead-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

module.exports = analysisQueue;
```

### 2.3 Create Analysis Workers

```javascript
// src/workers/analysisWorker.js
const { Worker } = require('bullmq');
const { connection } = require('../queues/config');
const websiteAnalyzer = require('../services/websiteAnalyzer');
const seoAnalyzer = require('../services/seoAnalyzer');
const gbpAnalyzer = require('../services/gbpAnalyzer');
const scoringEngine = require('../services/scoringEngine');

const worker = new Worker('lead-analysis', async (job) => {
  const { businessId } = job.data;
  
  await job.updateProgress(10);
  
  // Run analyzers in parallel
  const [websiteAudit, seoAudit, gbpAudit] = await Promise.allSettled([
    websiteAnalyzer.analyze(businessId),
    seoAnalyzer.analyze(businessId),
    gbpAnalyzer.analyze(businessId)
  ]);
  
  await job.updateProgress(70);
  
  // Calculate score and generate insights
  const intelligence = await scoringEngine.calculate({
    businessId,
    websiteAudit: websiteAudit.value,
    seoAudit: seoAudit.value,
    gbpAudit: gbpAudit.value
  });
  
  await job.updateProgress(100);
  
  return intelligence;
}, {
  connection,
  concurrency: 5 // Process 5 leads simultaneously
});

module.exports = worker;
```

---

## 🔍 Phase 3: Analysis Services

### 3.1 Website Analyzer Service

```javascript
// src/services/websiteAnalyzer.js
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');

class WebsiteAnalyzer {
  async analyze(businessId) {
    const business = await Business.findById(businessId);
    
    if (!business.website) {
      return {
        has_website: false,
        weaknesses: ['NO_WEBSITE']
      };
    }
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Run Lighthouse audit
      const { lhr } = await lighthouse(business.website, {
        port: new URL(browser.wsEndpoint()).port,
        output: 'json',
        onlyCategories: ['performance', 'accessibility']
      });
      
      await page.goto(business.website, { waitUntil: 'networkidle2' });
      
      // Detect elements
      const hasWhatsapp = await this.detectWhatsApp(page);
      const hasContactForm = await this.detectContactForm(page);
      const hasCTA = await this.detectCTA(page);
      const hasAnalytics = await this.detectAnalytics(page);
      
      return {
        has_website: true,
        url: business.website,
        mobile_score: lhr.categories.accessibility.score * 100,
        speed_score: lhr.categories.performance.score * 100,
        is_https: business.website.startsWith('https'),
        has_whatsapp: hasWhatsapp,
        has_contact_form: hasContactForm,
        has_cta: hasCTA,
        has_analytics: hasAnalytics,
        last_checked: new Date()
      };
    } finally {
      await browser.close();
    }
  }
  
  async detectWhatsApp(page) {
    return await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      const hasWhatsappText = text.includes('whatsapp');
      const hasWhatsappLink = !!document.querySelector('a[href*="wa.me"], a[href*="whatsapp"]');
      return hasWhatsappText || hasWhatsappLink;
    });
  }
  
  async detectContactForm(page) {
    return await page.evaluate(() => {
      return !!document.querySelector('form[action*="contact"], form input[type="email"]');
    });
  }
  
  async detectCTA(page) {
    return await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a.btn, .button'));
      const ctaKeywords = ['book', 'contact', 'enquiry', 'call', 'get quote', 'reserve'];
      return buttons.some(btn => {
        const text = btn.innerText.toLowerCase();
        return ctaKeywords.some(keyword => text.includes(keyword));
      });
    });
  }
  
  async detectAnalytics(page) {
    return await page.evaluate(() => {
      const hasGA = !!window.ga || !!window.gtag;
      const hasPixel = !!window.fbq;
      return hasGA || hasPixel;
    });
  }
}

module.exports = new WebsiteAnalyzer();
```

### 3.2 SEO Analyzer Service

```javascript
// src/services/seoAnalyzer.js
const axios = require('axios');
const cheerio = require('cheerio');

class SEOAnalyzer {
  async analyze(businessId) {
    const business = await Business.findById(businessId);
    
    if (!business.website) {
      return { is_indexed: false };
    }
    
    try {
      // Check Google indexing
      const isIndexed = await this.checkIndexing(business.website);
      
      // Fetch page content
      const { data: html } = await axios.get(business.website, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const $ = cheerio.load(html);
      
      const title = $('title').text();
      const metaDescription = $('meta[name="description"]').attr('content');
      const hasSchema = !!$('script[type="application/ld+json"]').length;
      
      // Check for local keywords
      const bodyText = $('body').text().toLowerCase();
      const hasLocalKeywords = this.detectLocalKeywords(bodyText, business);
      
      return {
        is_indexed: isIndexed,
        has_title: !!title,
        title_length: title?.length || 0,
        has_meta_description: !!metaDescription,
        has_local_keywords: hasLocalKeywords,
        has_schema_markup: hasSchema,
        last_checked: new Date()
      };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  async checkIndexing(url) {
    try {
      const searchUrl = `https://www.google.com/search?q=site:${new URL(url).hostname}`;
      const { data } = await axios.get(searchUrl);
      return !data.includes('did not match any documents');
    } catch {
      return false;
    }
  }
  
  detectLocalKeywords(text, business) {
    const keywords = [
      business.city?.toLowerCase(),
      business.state?.toLowerCase(),
      business.category?.toLowerCase()
    ].filter(Boolean);
    
    return keywords.some(keyword => text.includes(keyword));
  }
}

module.exports = new SEOAnalyzer();
```

### 3.3 GBP Analyzer Service

```javascript
// src/services/gbpAnalyzer.js
class GBPAnalyzer {
  async analyze(businessId) {
    const business = await Business.findById(businessId);
    
    // Use existing data from Places API
    const hasOwnerReplies = await this.checkOwnerReplies(business.place_id);
    
    return {
      rating: business.rating || 0,
      review_count: business.review_count || 0,
      has_owner_replies: hasOwnerReplies,
      photo_count: business.images?.length || 0,
      has_business_hours: !!business.opening_hours,
      has_description: !!business.description,
      last_checked: new Date()
    };
  }
  
  async checkOwnerReplies(placeId) {
    // This would require Places API reviews endpoint
    // For MVP, can estimate based on rating/review ratio
    return false; // Placeholder
  }
}

module.exports = new GBPAnalyzer();
```

---

## 🎯 Phase 4: Scoring Engine

### 4.1 Weakness Detection & Scoring

```javascript
// src/services/scoringEngine.js
class ScoringEngine {
  async calculate({ businessId, websiteAudit, seoAudit, gbpAudit }) {
    const weaknesses = [];
    let totalScore = 100; // Start with perfect score, deduct for issues
    
    // Website weaknesses
    if (!websiteAudit.has_website) {
      weaknesses.push({
        type: 'NO_WEBSITE',
        severity: 'CRITICAL',
        score_impact: -40
      });
      totalScore -= 40;
    } else {
      if (websiteAudit.mobile_score < 50) {
        weaknesses.push({
          type: 'POOR_MOBILE',
          severity: 'HIGH',
          score_impact: -15
        });
        totalScore -= 15;
      }
      
      if (websiteAudit.speed_score < 50) {
        weaknesses.push({
          type: 'SLOW_SPEED',
          severity: 'MEDIUM',
          score_impact: -10
        });
        totalScore -= 10;
      }
      
      if (!websiteAudit.is_https) {
        weaknesses.push({
          type: 'NO_HTTPS',
          severity: 'HIGH',
          score_impact: -12
        });
        totalScore -= 12;
      }
      
      if (!websiteAudit.has_whatsapp && !websiteAudit.has_contact_form) {
        weaknesses.push({
          type: 'NO_LEAD_CAPTURE',
          severity: 'CRITICAL',
          score_impact: -15
        });
        totalScore -= 15;
      }
      
      if (!websiteAudit.has_analytics) {
        weaknesses.push({
          type: 'NO_ANALYTICS',
          severity: 'MEDIUM',
          score_impact: -8
        });
        totalScore -= 8;
      }
    }
    
    // GBP weaknesses
    if (gbpAudit.rating < 4.2) {
      weaknesses.push({
        type: 'LOW_RATING',
        severity: 'HIGH',
        score_impact: -10
      });
      totalScore -= 10;
    }
    
    if (gbpAudit.review_count < 10) {
      weaknesses.push({
        type: 'LOW_REVIEWS',
        severity: 'MEDIUM',
        score_impact: -10
      });
      totalScore -= 10;
    }
    
    if (!gbpAudit.has_owner_replies) {
      weaknesses.push({
        type: 'NO_OWNER_REPLIES',
        severity: 'MEDIUM',
        score_impact: -5
      });
      totalScore -= 5;
    }
    
    if (gbpAudit.photo_count < 10) {
      weaknesses.push({
        type: 'FEW_PHOTOS',
        severity: 'LOW',
        score_impact: -5
      });
      totalScore -= 5;
    }
    
    // SEO weaknesses
    if (!seoAudit.is_indexed) {
      weaknesses.push({
        type: 'NOT_INDEXED',
        severity: 'CRITICAL',
        score_impact: -20
      });
      totalScore -= 20;
    }
    
    if (!seoAudit.has_local_keywords) {
      weaknesses.push({
        type: 'POOR_SEO',
        severity: 'MEDIUM',
        score_impact: -8
      });
      totalScore -= 8;
    }
    
    // Generate sales insights
    const salesInsights = this.generateInsights(weaknesses);
    
    // Determine priority
    const priority = this.calculatePriority(totalScore);
    
    // Save to database
    const intelligence = await LeadIntelligence.findOneAndUpdate(
      { business_id: businessId },
      {
        website_audit: websiteAudit,
        seo_audit: seoAudit,
        gbp_audit: gbpAudit,
        weaknesses,
        sales_insights: salesInsights,
        scoring: {
          total_score: Math.max(0, totalScore),
          calculated_at: new Date()
        }
      },
      { upsert: true, new: true }
    );
    
    // Update Business model
    await Business.findByIdAndUpdate(businessId, {
      lead_score: Math.max(0, totalScore),
      priority,
      'intelligence.last_analyzed': new Date(),
      'intelligence.analysis_status': 'completed'
    });
    
    return intelligence;
  }
  
  generateInsights(weaknesses) {
    const insights = [];
    const templates = {
      NO_WEBSITE: {
        message: 'No website — customers can\'t find you online',
        pitch: 'Sir, when people search for {category} in {city}, they can\'t find your business online. We can create a professional website to capture these enquiries.'
      },
      POOR_MOBILE: {
        message: 'Website not mobile-friendly — losing 70% of visitors',
        pitch: 'Your website doesn\'t work properly on mobile phones. Most customers browse on mobile, so you\'re losing enquiries daily.'
      },
      NO_LEAD_CAPTURE: {
        message: 'No WhatsApp or enquiry form — leads are leaking',
        pitch: 'People visit your website but there\'s no easy way to contact you. We can add WhatsApp integration and enquiry forms.'
      },
      LOW_REVIEWS: {
        message: 'Low review count — customers trust businesses with more reviews',
        pitch: 'You have a good rating but only {count} reviews. We can help you get more customer reviews to build trust.'
      },
      NOT_INDEXED: {
        message: 'Not showing in Google search — invisible to customers',
        pitch: 'Your website isn\'t appearing in Google searches. We can fix your SEO so customers can find you.'
      }
    };
    
    weaknesses.forEach((weakness, index) => {
      const template = templates[weakness.type];
      if (template) {
        insights.push({
          category: this.getCategory(weakness.type),
          message: template.message,
          pitch_template: template.pitch,
          priority: index + 1
        });
      }
    });
    
    return insights;
  }
  
  getCategory(weaknessType) {
    const categoryMap = {
      NO_WEBSITE: 'website',
      POOR_MOBILE: 'website',
      SLOW_SPEED: 'website',
      NO_HTTPS: 'website',
      NO_LEAD_CAPTURE: 'website',
      NO_ANALYTICS: 'website',
      LOW_RATING: 'gbp',
      LOW_REVIEWS: 'gbp',
      NO_OWNER_REPLIES: 'gbp',
      FEW_PHOTOS: 'gbp',
      NOT_INDEXED: 'seo',
      POOR_SEO: 'seo'
    };
    return categoryMap[weaknessType] || 'other';
  }
  
  calculatePriority(score) {
    if (score >= 70) return 'HOT';
    if (score >= 40) return 'WARM';
    return 'COLD';
  }
}

module.exports = new ScoringEngine();
```

---

## 🌐 Phase 5: API Endpoints

### 5.1 Trigger Analysis

```javascript
// src/routes/intelligence.js
router.post('/businesses/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update status
    await Business.findByIdAndUpdate(id, {
      'intelligence.analysis_status': 'pending'
    });
    
    // Queue analysis job
    const job = await analysisQueue.add('analyze-lead', {
      businessId: id
    });
    
    res.json({
      success: true,
      jobId: job.id,
      message: 'Analysis queued'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 5.2 Get Intelligence

```javascript
router.get('/businesses/:id/intelligence', async (req, res) => {
  try {
    const intelligence = await LeadIntelligence.findOne({
      business_id: req.params.id
    }).populate('business_id');
    
    res.json({
      success: true,
      intelligence
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 5.3 Get Prioritized Leads

```javascript
router.get('/leads/prioritized', async (req, res) => {
  try {
    const { priority, minScore, category, city } = req.query;
    
    const filter = {
      'intelligence.analysis_status': 'completed'
    };
    
    if (priority) filter.priority = priority;
    if (minScore) filter.lead_score = { $gte: parseInt(minScore) };
    if (category) filter.category = new RegExp(category, 'i');
    if (city) filter.city = new RegExp(city, 'i');
    
    const leads = await Business.find(filter)
      .sort({ lead_score: -1, priority: 1 })
      .limit(50)
      .lean();
    
    // Fetch intelligence for each
    const leadsWithIntelligence = await Promise.all(
      leads.map(async (lead) => {
        const intelligence = await LeadIntelligence.findOne({
          business_id: lead._id
        });
        return { ...lead, intelligence };
      })
    );
    
    res.json({
      success: true,
      leads: leadsWithIntelligence
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🎨 Phase 6: Frontend Dashboard

### 6.1 Sales Intelligence View

Create new page: `frontend/src/pages/SalesIntelligence.jsx`

**Key Features:**
- Priority filter (HOT/WARM/COLD)
- Score range slider
- Weakness type filters
- Lead cards with:
  - Priority badge
  - Score visualization
  - Weakness icons
  - Auto-generated pitch
  - Quick actions (Call, Email, WhatsApp)

### 6.2 Lead Detail Modal

**Sections:**
1. **Overview** - Name, category, location, contact
2. **Weakness Analysis** - Visual breakdown with icons
3. **Sales Insights** - Ready-made talking points
4. **Audit Details** - Technical scores (collapsible)
5. **Actions** - Mark as contacted, add notes, schedule follow-up

---

## ⚙️ Phase 7: Automation & Triggers

### 7.1 Auto-Trigger on Lead Creation

```javascript
// In deduplicator.js after creating business
if (normalized.status === 'new') {
  // Queue analysis
  await analysisQueue.add('analyze-lead', {
    businessId: business._id
  }, {
    delay: 5000 // Wait 5s to ensure data is saved
  });
}
```

### 7.2 Scheduled Re-Analysis

```javascript
// src/cron/reAnalysis.js
const cron = require('node-cron');

// Re-analyze all leads monthly
cron.schedule('0 0 1 * *', async () => {
  const businesses = await Business.find({
    'intelligence.last_analyzed': {
      $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  });
  
  for (const business of businesses) {
    await analysisQueue.add('analyze-lead', {
      businessId: business._id
    });
  }
});
```

---

## 🐳 Phase 8: Docker Setup

### 8.1 Add Redis to docker-compose.yml

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

### 8.2 Add Worker Container

```yaml
  analysis-worker:
    build: ./backend/api
    command: node src/workers/analysisWorker.js
    depends_on:
      - redis
      - mongodb
    environment:
      - REDIS_HOST=redis
      - MONGODB_URI=mongodb://mongodb:27017/w3spiders-crm
    deploy:
      replicas: 3  # Scale workers
```

---

## 📈 Phase 9: Monitoring & Optimization

### 9.1 Job Monitoring Dashboard

Use Bull Board for queue monitoring:

```javascript
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [new BullMQAdapter(analysisQueue)],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
```

### 9.2 Performance Metrics

Track:
- Average analysis time per lead
- Success/failure rates
- Queue depth
- Worker utilization

---

## 🚀 Implementation Timeline

### Week 1: Foundation
- [ ] Database schema updates
- [ ] BullMQ setup
- [ ] Basic queue infrastructure
- [ ] Analysis job model

### Week 2: Analysis Services
- [ ] Website analyzer (Puppeteer + Lighthouse)
- [ ] SEO analyzer
- [ ] GBP analyzer
- [ ] Scoring engine

### Week 3: Integration
- [ ] API endpoints
- [ ] Auto-trigger on lead creation
- [ ] Worker deployment
- [ ] Testing & debugging

### Week 4: Frontend & Polish
- [ ] Sales Intelligence dashboard
- [ ] Lead detail views
- [ ] Filters & sorting
- [ ] Documentation

---

## 💰 Cost Considerations

**Infrastructure:**
- Redis: Free (self-hosted)
- Puppeteer: CPU-intensive (consider serverless for scale)
- Lighthouse: ~5-10s per analysis

**Scaling:**
- 1000 leads/day = ~3-4 hours with 5 workers
- Consider rate limiting for external APIs
- Cache results for 30 days

---

## 🎯 Success Metrics

**Technical:**
- 95%+ analysis completion rate
- < 2 min average analysis time
- < 5% error rate

**Business:**
- 30%+ increase in call conversion
- 50%+ reduction in research time per lead
- Higher quality conversations

---

## 🔒 Legal & Compliance

✅ **Safe Practices:**
- Analyzing public data only
- Respecting robots.txt
- Rate limiting external requests
- No scraping of private systems
- Value-based audits

---

## 📚 Next Steps

**Choose your starting point:**

1. **Database First** → Set up schemas and models
2. **Worker First** → Build analysis services
3. **Frontend First** → Design dashboard UI
4. **Full Stack** → Implement end-to-end for one analyzer

**Recommended:** Start with **Database + Website Analyzer** for quick wins.
