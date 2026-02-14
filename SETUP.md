# Setup Guide - Google Maps Scraper System

## Prerequisites

1. **Docker** installed and running
2. **MongoDB Atlas** account (free tier works perfectly)
3. **Node.js** 20+ (for local development only)

## Step 1: Set Up MongoDB Atlas (Free)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
5. Replace `<password>` with your actual password
6. Add `/scraper_db` at the end before the query parameters

Your final connection string should look like:
```
mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/scraper_db?retryWrites=true&w=majority
```

## Step 2: Build the Scraper Image

```bash
cd /Users/priyanshu/Desktop/google-maps-scrapper/scraper
docker build -t scraper-image:latest .
cd ..
```

## Step 3: Configure Environment

```bash
# Edit the .env file
nano backend/.env
```

Update the `MONGODB_URI` with your MongoDB Atlas connection string:
```bash
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/scraper_db?retryWrites=true&w=majority
```

## Step 4: Start the Backend

```bash
docker-compose up -d
```

Check if it's running:
```bash
docker-compose logs -f backend
```

You should see:
```
MongoDB Connected: cluster0-xxxxx.mongodb.net
Server running on port 3000
```

## Step 5: Test the System

### Health Check
```bash
curl http://localhost:3000/health
```

### Trigger a Test Scrape
```bash
curl -X POST http://localhost:3000/admin/scrape/start \
  -H "Content-Type: application/json" \
  -d '{"queries": ["restaurants in Jaipur"]}'
```

You'll get a response like:
```json
{
  "success": true,
  "job_id": "abc-123-def",
  "status": "pending",
  "message": "Scrape job started"
}
```

### Check Job Status
```bash
curl http://localhost:3000/admin/jobs/abc-123-def
```

### View All Jobs
```bash
curl http://localhost:3000/admin/jobs
```

### Get System Stats
```bash
curl http://localhost:3000/admin/stats
```

### Search Businesses
```bash
curl "http://localhost:3000/admin/businesses?limit=10"
```

## Step 6: Enable Scheduler (Optional)

Edit `backend/.env`:
```bash
ENABLE_SCHEDULER=true
SCHEDULE_CRON=0 0 * * *  # Daily at midnight
SCHEDULED_QUERIES=restaurants in Jaipur,hotels in Jaipur,cafes in Jaipur
```

Restart:
```bash
docker-compose restart backend
```

## Troubleshooting

### MongoDB Connection Failed
- Check your connection string is correct
- Ensure your IP is whitelisted in MongoDB Atlas (Network Access)
- Verify username/password are correct

### Scraper Job Fails
- Check logs: `docker-compose logs backend`
- Verify scraper image exists: `docker images | grep scraper-image`
- Check volume permissions: `ls -la volumes/scraper-output`

### Backend Won't Start
- Check if port 3000 is available: `lsof -i :3000`
- Verify .env file exists: `cat backend/.env`
- Check Docker socket access: `ls -la /var/run/docker.sock`

## Resource Usage

With cloud MongoDB, the system uses:
- **Backend Container**: ~150 MB RAM
- **Scraper (when running)**: ~300-400 MB RAM
- **Total**: < 600 MB RAM

Perfect for a 1GB VPS!

## Production Tips

1. **Security**: Add authentication to your API endpoints
2. **Monitoring**: Use MongoDB Atlas monitoring dashboard
3. **Backups**: MongoDB Atlas provides automatic backups
4. **Scaling**: Increase `SCHEDULED_QUERIES` or run multiple backend instances
5. **Logs**: Set up log aggregation (e.g., Papertrail, Loggly)

## Stopping the System

```bash
docker-compose down
```

Data remains safe in MongoDB Atlas.
