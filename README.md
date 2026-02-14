# Quick Start Guide

## 🎯 What You Have

A production-ready, cloud-native Google Maps scraper with:
- ✅ MongoDB Atlas for database
- ✅ Cloudinary for file storage  
- ✅ Job-based Docker architecture
- ✅ RESTful API
- ✅ Automatic deduplication
- ✅ Scheduler support

## 📋 Prerequisites

1. **MongoDB Atlas Account** (free tier works)
   - Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   
2. **Cloudinary Account** (free tier works)
   - Sign up at [cloudinary.com](https://cloudinary.com)

3. **Docker** installed and running

## 🚀 Setup Steps

### 1. Configure MongoDB Atlas

1. Create a free cluster
2. Click "Connect" → "Connect your application"
3. Copy connection string
4. Replace `<password>` with your password
5. Add `/scraper_db` before query parameters

Example:
```
mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/scraper_db?retryWrites=true&w=majority
```

### 2. Configure Cloudinary

1. Go to [cloudinary.com/console](https://cloudinary.com/console)
2. Copy your credentials:
   - Cloud Name
   - API Key
   - API Secret

### 3. Update Environment Variables

Edit `backend/.env`:

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://your-user:your-pass@cluster.mongodb.net/scraper_db?retryWrites=true&w=majority

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Other settings (already configured)
SCRAPER_IMAGE=scraper-image:latest
MAX_RESULTS=70
CLEANUP_TEMP=true
ENABLE_SCHEDULER=false
```

### 4. Start the System

```bash
# Make sure you're in the project root
cd /Users/priyanshu/Desktop/google-maps-scrapper

# Start the backend
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

You should see:
```
MongoDB Connected: cluster0-xxxxx.mongodb.net
Server running on port 3000
```

## 🧪 Test the System

### Trigger a Scrape

```bash
curl -X POST http://localhost:3000/admin/scrape/start \
  -H "Content-Type: application/json" \
  -d '{"queries": ["restaurants in Jaipur"]}'
```

Response:
```json
{
  "success": true,
  "job_id": "abc-123-def",
  "status": "pending"
}
```

### Check Job Status

```bash
curl http://localhost:3000/admin/jobs/abc-123-def
```

### View System Stats

```bash
curl http://localhost:3000/admin/stats
```

### Search Businesses

```bash
curl "http://localhost:3000/admin/businesses?limit=10"
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/scrape/start` | POST | Trigger scrape |
| `/admin/jobs` | GET | List all jobs |
| `/admin/jobs/:id` | GET | Get job details |
| `/admin/stats` | GET | System statistics |
| `/admin/businesses` | GET | Search businesses |

## 🔧 Configuration Options

### Enable Scheduler

Edit `backend/.env`:
```bash
ENABLE_SCHEDULER=true
SCHEDULE_CRON=0 0 * * *  # Daily at midnight
SCHEDULED_QUERIES=restaurants in Jaipur,hotels in Jaipur
```

Restart:
```bash
docker-compose restart backend
```

### Cron Examples

- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours
- `0 0 */3 * *` - Every 3 days

## 🐛 Troubleshooting

### MongoDB Connection Failed
- Verify connection string is correct
- Whitelist your IP in MongoDB Atlas (Network Access)
- Check username/password

### Cloudinary Upload Failed
- Verify API credentials
- Check Cloudinary dashboard for errors

### Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Verify .env file
cat backend/.env

# Restart
docker-compose restart backend
```

## 📁 Where is Data Stored?

- **Database**: MongoDB Atlas (cloud)
- **Files**: Cloudinary (cloud)
- **No local storage required!**

## 💰 Resource Usage

- Backend: ~150 MB RAM
- Scraper (when running): ~300-400 MB RAM
- **Total: < 600 MB** - Perfect for 1GB VPS!

## 📚 Documentation

- `README.md` - This file
- `SETUP.md` - Detailed setup guide
- `walkthrough.md` - Complete implementation details

## 🎉 Next Steps

1. Configure your cloud services
2. Test with sample queries
3. Enable scheduler (optional)
4. **Deploy to production!** → See [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🚀 Production Deployment

Ready to deploy to your Contabo VPS? Check out the complete deployment guide:

**[📖 DEPLOYMENT.md](DEPLOYMENT.md)** - Complete production deployment guide including:
- Initial VPS setup
- GitHub Actions CI/CD pipeline
- Nginx configuration for `api.leads.w3spiders.com`
- Monitoring and troubleshooting
- Rollback procedures

---

**Need help?** Check the detailed `SETUP.md` guide.
