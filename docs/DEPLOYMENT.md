# Deployment Guide

This document provides detailed instructions for deploying the Job Tracker application to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Project**: Set up with all required tables and RLS policies
2. **Environment Variables**: All required environment variables configured
3. **Database Schema**: Properly migrated and seeded
4. **Build Success**: Application builds without errors locally

## Vercel Deployment (Recommended)

Vercel provides the best experience for Next.js applications with automatic deployments, preview environments, and optimized performance.

### Initial Setup

1. **Connect Repository**
   ```bash
   # Push your code to GitHub if not already done
   git remote add origin https://github.com/yourusername/job-tracker.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Choose "Next.js" framework preset

3. **Configure Environment Variables**
   In Vercel dashboard → Project Settings → Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Deploy**
   - Click "Deploy" - Vercel will automatically build and deploy
   - Your application will be available at `https://your-project.vercel.app`

### Automatic Deployments

Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches and pull requests

### Custom Domain

1. **Add Domain** in Vercel dashboard → Project → Settings → Domains
2. **Configure DNS** at your domain provider:
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   ```
3. **SSL Certificate** is automatically provisioned

### Build Configuration

Create `vercel.json` if custom configuration is needed:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

## Netlify Deployment

### Setup

1. **Connect Repository** in Netlify dashboard
2. **Build Settings**:
   ```
   Build command: npm run build && npm run export
   Publish directory: out
   ```
3. **Environment Variables**: Add in Site Settings → Environment Variables
4. **Deploy**: Automatic deployment on git push

### Configuration

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NPM_FLAGS = "--prefix=/dev/null"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
```

## Railway Deployment

Railway provides an easy way to deploy full-stack applications.

### Setup

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Initialize**
   ```bash
   railway login
   railway init
   ```

3. **Environment Variables**
   ```bash
   railway variables set NEXT_PUBLIC_SUPABASE_URL=your_url
   railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### Configuration

Create `railway.toml`:
```toml
[build]
  builder = "NIXPACKS"
  buildCommand = "npm run build"

[deploy]
  startCommand = "npm start"
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 10
```

## Docker Deployment

For containerized deployments on any platform supporting Docker.

### Dockerfile

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  job-tracker:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - job-tracker
    restart: unless-stopped
```

### Build and Run

```bash
# Build the image
docker build -t job-tracker .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  job-tracker

# Or use docker-compose
docker-compose up -d
```

## AWS Deployment

### Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize**
   ```bash
   eb init job-tracker
   ```

3. **Create Environment**
   ```bash
   eb create production
   ```

4. **Set Environment Variables**
   ```bash
   eb setenv NEXT_PUBLIC_SUPABASE_URL=your_url
   eb setenv NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

5. **Deploy**
   ```bash
   eb deploy
   ```

### Lambda (Serverless)

Using Serverless Framework:

1. **Install Serverless**
   ```bash
   npm install -g serverless
   npm install --save-dev serverless-nextjs-plugin
   ```

2. **Create serverless.yml**
   ```yaml
   service: job-tracker
   
   plugins:
     - serverless-nextjs-plugin
   
   provider:
     name: aws
     runtime: nodejs18.x
     region: us-east-1
     
   custom:
     serverless-nextjs:
       cloudFront:
         distributionId: ${env:CLOUDFRONT_DISTRIBUTION_ID}
   ```

3. **Deploy**
   ```bash
   serverless deploy
   ```

## Database Setup

### Supabase Configuration

Ensure your Supabase project has the required tables and RLS policies:

```sql
-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own contacts" ON contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts" ON contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts" ON contacts
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables...
```

### Database Migrations

If using custom migrations:

```bash
# Create migration
supabase migration new create_initial_tables

# Apply migrations
supabase db push
```

## Environment Variables

### Required Variables

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Security Considerations

1. **Never commit `.env` files** to version control
2. **Use platform-specific secret management**:
   - Vercel: Environment Variables in dashboard
   - AWS: Parameter Store or Secrets Manager  
   - Docker: Secrets or env files with restricted permissions
3. **Rotate keys regularly**
4. **Use least privilege principle** for API keys

## Performance Optimization

### Next.js Configuration

Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['your-domain.com'],
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  swcMinify: true,
}

module.exports = nextConfig
```

### Bundle Analysis

```bash
# Analyze bundle size
npm install --save-dev @next/bundle-analyzer

# Add to next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

# Run analysis
ANALYZE=true npm run build
```

### CDN Configuration

For static assets, configure your CDN:
- **Images**: Optimize and serve from CDN
- **Fonts**: Preload critical fonts
- **Scripts**: Bundle splitting and lazy loading

## Monitoring and Maintenance

### Health Checks

Implement health check endpoints:
```typescript
// pages/api/health.ts
export default function handler(req, res) {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version 
  })
}
```

### Error Monitoring

Integrate error tracking:
- **Sentry**: For error tracking and performance monitoring
- **LogRocket**: For user session recording
- **Vercel Analytics**: For web vitals and performance metrics

### Backup Strategy

1. **Database Backups**: Supabase provides automatic backups
2. **Code Backups**: Git repository serves as code backup
3. **User Data**: Regular exports for disaster recovery

## SSL/TLS Configuration

### Automatic SSL (Recommended)

Most platforms provide automatic SSL:
- **Vercel**: Automatic SSL with custom domains
- **Netlify**: Let's Encrypt certificates
- **Railway**: Automatic HTTPS

### Manual SSL Setup

For custom deployments:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Rollback Strategy

### Vercel Rollback
```bash
# Rollback to previous deployment
vercel --prod --target production rollback
```

### Docker Rollback
```bash
# Tag and rollback to previous version
docker tag job-tracker:current job-tracker:rollback
docker-compose down
docker-compose up -d
```

### Database Rollback
- Use Supabase point-in-time recovery
- Maintain database migration scripts
- Test rollback procedures regularly

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check TypeScript errors
   - Verify environment variables
   - Review dependency versions

2. **Runtime Errors**
   - Check server logs
   - Verify database connectivity
   - Validate API endpoints

3. **Performance Issues**
   - Analyze bundle size
   - Check database query performance
   - Monitor memory usage

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

### Health Monitoring

Set up monitoring dashboards:
- Response time monitoring
- Error rate tracking  
- Database connection health
- Memory and CPU usage