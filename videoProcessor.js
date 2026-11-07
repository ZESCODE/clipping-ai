import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

ffmpeg.setFfmpegPath(ffmpegStatic);

export class VideoProcessor {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.outputDir = path.join(process.cwd(), 'output');
    this.tempDir = path.join(process.cwd(), 'temp');
    
    [this.uploadDir, this.outputDir, this.tempDir].forEach(dir => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    });
  }

  async registerVideo(file, userId) {
    const videoId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    const newFilename = `${crypto.randomUUID()}${ext}`;
    const newPath = path.join(this.uploadDir, newFilename);
    
    // Move file to uploads
    await fs.promises.rename(file.path, newPath);
    
    // Get video metadata
    const metadata = await this.getVideoMetadata(newPath);
    
    // Save to database (will be done by caller with db reference)
    const video = {
      id: crypto.randomUUID(),
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
      // Update job status to processing
      // await db.updateJobStatus(jobId, 'processing');
      
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock moments
      const moments = this.generateMockMoments();
      
      // Update job with results
      // await db.updateJob(jobId, { status: 'completed', output: moments });
      
      console.log(`Analysis completed for job ${jobId}`);
    } catch (error) {
      console.error('Analysis failed:', error);
      // await db.updateJobStatus(jobId, 'failed', error.message);
    }
  }

  generateMockMoments() {
    const moments = [];
    const momentCount = Math.floor(Math.random() * 10) + 5;
    
    for (let i = 0; i < momentCount; i++) {
      const start = Math.random() * 300; // 5 min video
      const duration = 15 + Math.random() * 30; // 15-45 seconds
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
        ai_notes: `High energy moment with good hook potential`,
        hook_score: 0.5 + Math.random() * 0.5,
        viral_potential: 0.5 + Math.random() * 0.5,
        engagement_prediction: 0.5 + Math.random() * 0.5
      });
    }
    
    return moments.sort((a, b) => b.hook_score - a.hook_score);
  }

  async getAnalysis(videoId, userId) {
    // Would fetch from database
    return this.generateMockMoments();
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

  async generateClips(videoId, userId, moments, options = {}) {
    const jobId = crypto.randomUUID();
    
    // This would be an async job
    // For now, simulate clip generation
    
    const clips = moments.map((moment, index) => ({
      id: crypto.randomUUID(),
      video_id: videoId,
      moment_id: moment.id,
      start_time: moment.start_time,
      end_time: moment.end_time,
      duration: moment.duration,
      hook_score: moment.hook_score,
      viral_potential: moment.viral_potential,
      status: 'generated',
      platform_versions: {
        tiktok: { width: 1080, height: 1920 },
        youtube_shorts: { width: 1080, height: 1920 },
        instagram_reels: { width: 1080, height: 1920 }
      }
    }));
    
    return { clips, jobId: crypto.randomUUID() };
  }

  async getClips(videoId, userId) {
    // Would fetch from database
    return [];
  }

  async getJobStatus(jobId, userId) {
    // Would fetch from database
    return { status: 'completed', progress: 100 };
  }

  // Actual video processing with FFmpeg
  async extractClip(inputPath, outputPath, startTime, duration, options = {}) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .seekInput(options.start || 0)
        .duration(options.duration || 30)
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