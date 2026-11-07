# Clipping AI

AI-powered automated clipping platform for Whop Content Rewards, Vyro, and other clip marketplaces.

## Features

- **Campaign Management**: Sync and manage campaigns from Whop, Vyro, and manual sources
- **Video Processing**: Upload, analyze, and generate clips from long-form content
- **AI Analysis**: Moment detection, hook scoring, viral potential prediction
- **Multi-platform Posting**: Post to TikTok, YouTube Shorts, Instagram Reels, X
- **Earnings Tracking**: Real-time earnings dashboard with projections
- **Analytics**: Performance metrics, campaign analytics, platform comparisons

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Node.js + Express (serverless functions for Vercel)
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT with refresh tokens
- **AI**: OpenAI GPT for analysis and caption generation
- **Video**: FFmpeg for processing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- FFmpeg installed

### Installation

```bash
# Install dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Build client
cd client && npm run build && cd ..

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_jwt_secret
PORT=3092
DATABASE_URL=sqlite:./data/clipping-ai.db
```

### Production Deployment (Vercel)

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Campaigns
- `GET /api/campaigns` - List campaigns

### Earnings
- `GET /api/earnings/summary` - Get earnings summary

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard data

### Health
- `GET /api/health` - Health check

## Project Structure

```
clipping-ai/
├── api/                    # Vercel serverless functions
│   ├── auth/              # Authentication endpoints
│   ├── campaigns/         # Campaign endpoints
│   ├── earnings/          # Earnings endpoints
│   ├── analytics/         # Analytics endpoints
│   └── health.js          # Health check
├── client/                # React frontend
│   ├── src/
│   └── dist/              # Built output
├── lib/                   # Shared utilities
│   ├── database.js        # Database abstraction
│   └── auth.js            # Auth helpers
├── server.js              # Express server (development)
├── vercel.json            # Vercel configuration
└── package.json
```

## Deployment

### Vercel Configuration

The `vercel.json` configures:
- Build command: `npm run vercel-build`
- Output directory: `client/dist`
- API functions: `api/**/*.js`
- Rewrites for SPA routing

### Environment Variables for Production

```env
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_strong_jwt_secret
DATABASE_URL=your_production_database_url
```

## License

MIT