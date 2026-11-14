import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { execSync } from 'child_process';
// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ffmpeg-static ships a glibc binary — unusable on Termux/bionic. Pick the first
// candidate that actually executes: FFMPEG_PATH env, system ffmpeg, else the bundled one.
function resolveFfmpegPath() {
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg', ffmpegStatic].filter(Boolean);
  for (const bin of candidates) {
    try {
      execSync(`${JSON.stringify(bin)} -version`, { stdio: 'ignore', timeout: 10000 });
      console.log(`[videoProcessor] using ffmpeg: ${bin}`);
      return bin;
    } catch { /* try next */ }
  }
  return ffmpegStatic;
}

ffmpeg.setFfmpegPath(resolveFfmpegPath());

export class VideoProcessor {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.outputDir = path.join(process.cwd(), 'output');
    this.tempDir = path.join(process.cwd(), 'temp');
    this.clipsDir = path.join(process.cwd(), 'clips');

    [this.uploadDir, this.outputDir, this.tempDir, this.clipsDir].forEach(dir => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    });

    // In-memory state (DB persistence for these tables is still a TODO upstream)
    this.videos = new Map();    // videoId -> video row (incl. file_path, duration)
    this.analysis = new Map(); // videoId -> moments[]
    this.jobs = new Map();     // jobId -> { status, progress, output?, error? }
    this.clips = [];           // every generated clip record
  }

  async registerVideo(file, userId) {
    const videoId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    // Name the file after the video id so clips can be generated even after a
    // server restart (the in-memory video registry resets on boot).
    const newFilename = `${videoId}${ext}`;
    const newPath = path.join(this.uploadDir, newFilename);
    
    // Move file to uploads
    await fs.promises.rename(file.path, newPath);
    
    // Get video metadata
    const metadata = await this.getVideoMetadata(newPath);
    
    // Save to database (will be done by caller with db reference)
    const video = {
      id: videoId,
      user_id: null, // Will be set by caller
      original_filename: file.originalname,
      file_path: newPath,
      file_size: fs.statSync(newPath).size,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      codec: metadata.codec,
      status: 'uploaded',
      created_at: new Date().toISOString()
    };

    this.videos.set(video.id, video);
    return { video, path: newPath };
  }

  async getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: eval(videoStream?.r_frame_rate || '30/1'),
          codec: videoStream?.codec_name,
          bitrate: metadata.format.bit_rate
        });
      });
    });
  }

  async startAnalysis(videoId, userId, options = {}) {
    const jobId = crypto.randomUUID();
    
    // This would be saved to database
    
    // Start async processing
    this.processVideoAnalysis(jobId, videoId, userId, options).catch(console.error);
    
    return jobId;
  }

  async processVideoAnalysis(jobId, videoId, userId, options) {
    try {
      const video = this.videos.get(videoId);
      const moments = this.generateMockMoments(videoId, video?.duration);
      this.analysis.set(videoId, moments);
      this.jobs.set(jobId, { status: 'completed', progress: 100, output: moments });
      console.log(`Analysis completed for job ${jobId} (${moments.length} moments)`);
    } catch (error) {
      console.error('Analysis failed:', error);
      this.jobs.set(jobId, { status: 'failed', progress: 0, error: error.message });
    }
  }

  generateMockMoments(videoId = null, videoDuration = null) {
    // Bound moments to the real video duration when known (default: 5 min reel).
    const total = videoDuration && videoDuration > 30 ? videoDuration : 300;
    const moments = [];
    const momentCount = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < momentCount; i++) {
      const duration = 15 + Math.random() * 30; // 15-45 seconds
      const start = Math.random() * Math.max(1, total - duration - 1);
      moments.push({
        id: crypto.randomUUID(),
        start_time: start,
        end_time: start + duration,
        duration: duration,
        hook_score: Math.random() * 0.5 + 0.5,
        viral_potential: Math.random() * 0.5 + 0.5,
        engagement_prediction: Math.random() * 0.5 + 0.5,
        transcript_segment: `Sample transcript segment ${i}`,
        keywords: ['gaming', 'reaction', 'funny'],
        categories: ['gaming', 'entertainment'],
        recommended_platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        ai_notes: `High energy moment with good hook potential`
      });
    }

    return moments.sort((a, b) => b.hook_score - a.hook_score);
  }

  async getAnalysis(videoId, userId) {
    // Stored analysis if /analyze ran for this video, else a fresh bounded set.
    if (this.analysis.has(videoId)) return this.analysis.get(videoId);
    const video = this.videos.get(videoId);
    const fresh = this.generateMockMoments(videoId, video?.duration);
    this.analysis.set(videoId, fresh);
    return fresh;
  }

  async getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: eval(videoStream?.r_frame_rate || '30/1'),
          codec: videoStream?.codec_name,
          bitrate: metadata.format.bit_rate
        });
      });
    });
  }

  /**
   * Real clip generation: cuts each moment out of the source video with ffmpeg
   * (flattened to 1080x1920 vertical) and writes mp4s to clips/. Returns the
   * jobId immediately — poll /api/jobs/:jobId/status; finished records land in
   * the job's `output`.
   */
  async generateClips(videoId, userId, moments, options = {}) {
    const jobId = crypto.randomUUID();
    const job = { status: 'processing', progress: 0, output: [], error: null };
    this.jobs.set(jobId, job);

    this.runClipGeneration(jobId, videoId, moments, options).catch((err) => {
      job.status = 'failed';
      job.error = err.message;
    });

    return { jobId };
  }

  /** Rebuild a video row from uploads/<id>.<ext> when memory was lost (restart). */
  resolveVideo(videoId) {
    const cached = this.videos.get(videoId);
    if (cached && existsSync(cached.file_path)) return cached;
    for (const ext of ['.mp4', '.mov', '.m4v', '.webm']) {
      const candidate = path.join(this.uploadDir, `${videoId}${ext}`);
      if (existsSync(candidate)) {
        const video = {
          id: videoId, user_id: null, file_path: candidate,
          original_filename: `${videoId}${ext}`,
          file_size: fs.statSync(candidate).size,
          created_at: new Date().toISOString(),
        };
        this.videos.set(videoId, video);
        return video;
      }
    }
    return null;
  }

  async runClipGeneration(jobId, videoId, moments, options = {}) {
    const job = this.jobs.get(jobId);
    const video = this.resolveVideo(videoId);
    if (!video) throw new Error(`unknown video ${videoId} — upload it first`);
    if (!video.duration) {
      const meta = await this.getVideoMetadata(video.file_path).catch(() => null);
      if (meta) Object.assign(video, meta);
    }

    // Caller-supplied moments win; else use the stored analysis, else a fresh set.
    let list = Array.isArray(moments) && moments.length
      ? moments
      : (this.analysis.get(videoId) || this.generateMockMoments(videoId, video.duration));
    list = list
      .slice()
      .sort((a, b) => (b.hook_score || 0) - (a.hook_score || 0))
      .slice(0, Number(options.maxClips || 5));

    const clips = [];
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      // Clamp to the real runtime so a bad moment can't run past the end.
      const duration = Math.min(m.duration || 30, Math.max(5, video.duration * 0.9));
      const start = Math.max(0, Math.min(m.start_time, video.duration - duration - 0.1));
      const clipId = crypto.randomUUID();
      const outPath = path.join(this.clipsDir, `${clipId}.mp4`);

      await this.extractClip(video.file_path, outPath, start, duration, {
        vertical: true,
        source: { width: video.width, height: video.height },
      });

      clips.push({
        id: clipId,
        video_id: videoId,
        moment_id: m.id,
        file_path: outPath,
        start_time: start,
        end_time: start + duration,
        duration,
        width: 1080,
        height: 1920,
        file_size: fs.statSync(outPath).size,
        status: 'generated',
        hook_score: m.hook_score || 0,
        viral_potential: m.viral_potential || 0,
        platform_versions: {
          tiktok: { width: 1080, height: 1920 },
          youtube_shorts: { width: 1080, height: 1920 },
          instagram_reels: { width: 1080, height: 1920 }
        },
        created_at: new Date().toISOString()
      });
      job.progress = Math.round(((i + 1) / list.length) * 100);
    }

    this.clips.push(...clips);
    job.output = clips;
    job.status = 'completed';
    console.log(`Clips done for job ${jobId}: ${clips.length} files in ${this.clipsDir}`);
  }

  async getClips(videoId, userId) {
    return (this.clips || []).filter(c => c.video_id === videoId);
  }

  async getJobStatus(jobId, userId) {
    return this.jobs.get(jobId) || { status: 'unknown', progress: 0 };
  }

  // Actual video processing with FFmpeg
  async extractClip(inputPath, outputPath, startTime, duration, options = {}) {
    const start = startTime ?? options.start ?? 0;
    const dur = duration ?? options.duration ?? 30;
    const W = 1080, H = 1920;
    // Flatten any source aspect to 9:16 vertical (letterbox, never crop the action).
    const filters = options.vertical
      ? [
          `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`
        ]
      : [];
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .seekInput(start)
        .duration(dur)
        .videoFilters(filters)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async addCaptions(inputPath, outputPath, captions, options = {}) {
    // This would use FFmpeg to burn captions into video
    // Implementation would use drawtext filter or similar
    return new Promise((resolve, reject) => {
      // Simplified - would use drawtext filter with caption data
      resolve();
    });
  }

  async resizeForPlatform(inputPath, outputPath, platform, options = {}) {
    const specs = {
      tiktok: { width: 1080, height: 1920 },
      youtube_shorts: { width: 1080, height: 1920 },
      instagram_reels: { width: 1080, height: 1920 },
      x: { width: 1280, height: 720 }
    };

    const spec = specs[options.platform] || { width: 1080, height: 1920 };
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilter([
          `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease`,
          `pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2:black`
        ])
        .output(options.outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  async generateVariations(clipId, userId, options = {}) {
    const { count = 3, platforms = ['tiktok', 'youtube_shorts', 'instagram_reels'] } = options;
    const variations = [];
    
    for (let i = 0; i < count; i++) {
      variations.push({
        id: crypto.randomUUID(),
        parent_clip_id: clipId,
        variation_type: ['caption', 'crop', 'trim', 'music'][Math.floor(Math.random() * 4)],
        platform: platforms[i % platforms.length],
        changes: { caption: true, crop: Math.random() > 0.5 }
      });
    }
    
    return variations;
  }
}

export default VideoProcessor;