import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';
import { Database } from './database.js';
import { CampaignManager } from './campaignManager.js';
import { VideoProcessor } from './videoProcessor.js';
import { AIAnalyzer } from './aiAnalyzer.js';
import { PlatformPoster } from './platformPoster.js';
import { EarningsTracker } from './earningsTracker.js';
import { WhopAPI } from './whopAPI.js';
import { VyroAPI } from './vyroAPI.js';
import { Auth } from './auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3090;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from client build (if exists) but NOT index.html
const clientDistPath = join(__dirname, 'client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, { index: false }));
}

// Initialize services
const db = new Database();
const auth = new Auth(db);
const campaignManager = new CampaignManager(db);
const videoProcessor = new VideoProcessor();
const aiAnalyzer = new AIAnalyzer();
const platformPoster = new PlatformPoster();
const earningsTracker = new EarningsTracker(db);
const whopAPI = new WhopAPI();
const vyroAPI = new VyroAPI();

// Initialize database
await db.initialize();

// Multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('subscribe:campaigns', () => {
    socket.join('campaigns');
  });
  
  socket.on('subscribe:processing', (jobId) => {
    socket.join(`job:${jobId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available globally for services
global.io = io;

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = auth.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    const result = await auth.register(email, password, username);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await auth.login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await auth.getUser(req.user.userId);
    res.json({ user });
  } catch (err) {
    res.status(404).json({ error: 'User not found' });
  }
});

// ==================== CAMPAIGN ROUTES ====================
app.get('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const { platform, status, minCPM, maxCPM, sort } = req.query;
    const campaigns = await campaignManager.getCampaigns(req.user.id, {
      platform, status, minCPM, maxCPM, sort
    });
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await campaignManager.getCampaign(req.params.id, req.user.id);
    res.json({ campaign });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/campaigns/sync', authenticateToken, async (req, res) => {
  try {
    const { platforms } = req.body;
    const result = await campaignManager.syncCampaigns(req.user.id, platforms);
    res.json({ synced: result.count, campaigns: result.campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/join', authenticateToken, async (req, res) => {
  try {
    const result = await campaignManager.joinCampaign(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/campaigns/:id/submissions', authenticateToken, async (req, res) => {
  try {
    const submissions = await campaignManager.getSubmissions(req.params.id, req.user.id);
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== VIDEO PROCESSING ROUTES ====================
app.post('/api/videos/upload', authenticateToken, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    
    const video = await videoProcessor.registerVideo(req.file, req.user.id);
    res.json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/videos/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const { options } = req.body;
    const jobId = await videoProcessor.startAnalysis(req.params.id, req.user.id, options);
    res.json({ jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/videos/:id/analysis', authenticateToken, async (req, res) => {
  try {
    const analysis = await videoProcessor.getAnalysis(req.params.id, req.user.id);
    res.json({ analysis });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/videos/:id/generate-clips', authenticateToken, async (req, res) => {
  try {
    const { moments, options } = req.body;
    const jobId = await videoProcessor.generateClips(req.params.id, req.user.id, moments, options);
    res.json({ jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/videos/:id/clips', authenticateToken, async (req, res) => {
  try {
    const clips = await videoProcessor.getClips(req.params.id, req.user.id);
    res.json({ clips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:jobId/status', authenticateToken, async (req, res) => {
  try {
    const status = await videoProcessor.getJobStatus(req.params.jobId, req.user.id);
    res.json({ status });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ==================== AI ANALYSIS ROUTES ====================
app.post('/api/ai/detect-moments', authenticateToken, async (req, res) => {
  try {
    const { videoId, options } = req.body;
    const moments = await aiAnalyzer.detectMoments(videoId, req.user.id, options);
    res.json({ moments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/generate-captions', authenticateToken, async (req, res) => {
  try {
    const { clipId, style, platform } = req.body;
    const captions = await aiAnalyzer.generateCaptions(clipId, req.user.id, { style, platform });
    res.json({ captions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/score-hooks', authenticateToken, async (req, res) => {
  try {
    const { clips } = req.body;
    const scores = await aiAnalyzer.scoreHooks(clips, req.user.id);
    res.json({ scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/variations', authenticateToken, async (req, res) => {
  try {
    const { clipId, count, platforms } = req.body;
    const variations = await aiAnalyzer.generateVariations(clipId, req.user.id, { count, platforms });
    res.json({ variations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PLATFORM POSTING ROUTES ====================
app.post('/api/platforms/connect', authenticateToken, async (req, res) => {
  try {
    const { platform, credentials } = req.body;
    const result = await platformPoster.connectPlatform(req.user.id, platform, credentials);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/platforms', authenticateToken, async (req, res) => {
  try {
    const platforms = await platformPoster.getConnectedPlatforms(req.user.id);
    res.json({ platforms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clips/:id/post', authenticateToken, async (req, res) => {
  try {
    const { platforms, caption, scheduleTime } = req.body;
    const result = await platformPoster.postClip(req.params.id, req.user.id, {
      platforms, caption, scheduleTime
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clips/:id/schedule', authenticateToken, async (req, res) => {
  try {
    const { platforms, caption, scheduleTime, recurrence } = req.body;
    const result = await platformPoster.scheduleClip(req.params.id, req.user.id, {
      platforms, caption, scheduleTime, recurrence
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { platform, status, limit, offset } = req.query;
    const posts = await platformPoster.getPosts(req.user.id, { platform, status, limit, offset });
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EARNINGS ROUTES ====================
app.get('/api/earnings/summary', authenticateToken, async (req, res) => {
  try {
    const { period, platform } = req.query;
    const summary = await earningsTracker.getSummary(req.user.id, { period, platform });
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/earnings/details', authenticateToken, async (req, res) => {
  try {
    const { campaignId, platform, startDate, endDate, limit, offset } = req.query;
    const details = await earningsTracker.getDetails(req.user.id, {
      campaignId, platform, startDate, endDate, limit, offset
    });
    res.json({ details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/earnings/projections', authenticateToken, async (req, res) => {
  try {
    const { scenarios } = req.query;
    const projections = await earningsTracker.getProjections(req.user.id, scenarios);
    res.json({ projections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/earnings/calculator', authenticateToken, async (req, res) => {
  try {
    const { cpm, postsPerDay, avgViews, days } = req.query;
    const projection = earningsTracker.calculateProjection({
      cpm: parseFloat(cpm) || 1,
      postsPerDay: parseInt(postsPerDay) || 10,
      avgViews: parseInt(avgViews) || 8000,
      days: parseInt(days) || 30
    });
    res.json({ projection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== WHOP INTEGRATION ROUTES ====================
app.post('/api/whop/connect', authenticateToken, async (req, res) => {
  try {
    const { apiKey } = req.body;
    const result = await whopAPI.connect(req.user.id, apiKey);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/whop/campaigns', authenticateToken, async (req, res) => {
  try {
    const campaigns = await whopAPI.getCampaigns(req.user.id);
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whop/submit', authenticateToken, async (req, res) => {
  try {
    const { campaignId, clipId, postUrl, platform } = req.body;
    const result = await whopAPI.submitClip(req.user.id, campaignId, clipId, postUrl, platform);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whop/earnings', authenticateToken, async (req, res) => {
  try {
    const earnings = await whopAPI.getEarnings(req.user.id);
    res.json({ earnings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== VYRO INTEGRATION ROUTES ====================
app.post('/api/vyro/connect', authenticateToken, async (req, res) => {
  try {
    const { apiKey } = req.body;
    const result = await vyroAPI.connect(req.user.id, apiKey);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vyro/campaigns', authenticateToken, async (req, res) => {
  try {
    const campaigns = await vyroAPI.getCampaigns(req.user.id);
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vyro/submit', authenticateToken, async (req, res) => {
  try {
    const { campaignId, clipId, postUrl, platform } = req.body;
    const result = await vyroAPI.submitClip(req.user.id, campaignId, clipId, postUrl, platform);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ANALYTICS ROUTES ====================
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
    const dashboard = await earningsTracker.getDashboard(req.user.id);
    res.json({ dashboard });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/performance', authenticateToken, async (req, res) => {
  try {
    const { period, platform } = req.query;
    const performance = await earningsTracker.getPerformance(req.user.id, { period, platform });
    res.json({ performance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await platformPoster.getAccountAnalytics(req.user.id);
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SETTINGS ROUTES ====================
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db.getSettings(req.user.id);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db.updateSettings(req.user.id, req.body);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback (only if client build exists)
if (fs.existsSync(clientDistPath)) {
  app.get('*', (req, res) => {
    let html = fs.readFileSync(join(clientDistPath, 'index.html'), 'utf8');
    console.log('DEBUG: Read HTML length:', html.length);
    console.log('DEBUG: Before replace, has crossorigin:', html.includes('crossorigin'));
    // Remove crossorigin attribute which can cause issues on mobile
    html = html.replace(/\scrossorigin(\s*=\s*["']?["']?)?/g, '');
    html = html.replace(/crossorigin>/g, '>');
    console.log('DEBUG: After replace, has crossorigin:', html.includes('crossorigin'));
    res.send(html);
  });
} else {
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Client not built. API available at /api/*' });
  });
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`Clipping AI server running on port ${PORT}`);
});

export default app;