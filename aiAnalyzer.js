import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

export class AIAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = 'gpt-4-turbo-preview';
  }

  async detectMoments(videoId, userId, options = {}) {
    // This would analyze video transcription and visual content
    // For now, return mock moments
    
    const moments = [];
    const momentCount = options.count || 10;
    
    const categories = ['gaming', 'reaction', 'educational', 'entertainment', 'news', 'sports', 'music', 'tech'];
    const platforms = ['tiktok', 'youtube_shorts', 'instagram_reels', 'x'];
    
    for (let i = 0; i < options.count || 10; i++) {
      const start = Math.random() * 300;
      const duration = 15 + Math.random() * 30;
      
      moments.push({
        id: crypto.randomUUID(),
        video_id: videoId,
        start_time: Math.random() * 300,
        end_time: Math.random() * 300 + 15,
        duration: 15 + Math.random() * 30,
        hook_score: 0.5 + Math.random() * 0.5,
        viral_potential: 0.5 + Math.random() * 0.5,
        engagement_prediction: 0.5 + Math.random() * 0.5,
        transcript_segment: this.generateMockTranscript(),
        keywords: this.getRandomKeywords(),
        categories: [categories[Math.floor(Math.random() * categories.length)]],
        recommended_platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'].slice(0, Math.floor(Math.random() * 3) + 1),
        ai_notes: this.generateAINotes(),
        hook_score: 0.5 + Math.random() * 0.5,
        viral_potential: 0.5 + Math.random() * 0.5,
        engagement_prediction: 0.5 + Math.random() * 0.5,
        status: 'detected'
      });
    }
    
    return moments.sort((a, b) => b.hook_score - a.hook_score);
  }

  async generateCaptions(clipId, userId, options = {}) {
    const { style = 'tiktok', platform = 'tiktok' } = options;
    
    const captionStyles = {
      tiktok: {
        maxLength: 150,
        style: 'engaging, hook-first, emoji-heavy, trending hashtags',
        structure: 'Hook + Value + CTA + Hashtags'
      },
      youtube_shorts: {
        maxLength: 100,
        style: 'clear, descriptive, searchable',
        structure: 'Title + Description + Hashtags'
      },
      instagram_reels: {
        maxLength: 125,
        style: 'aesthetic, community-focused, saveable',
        structure: 'Hook + Value + Save/Share CTA + Hashtags'
      },
      x: {
        maxLength: 280,
        style: 'conversational, thread-ready',
        structure: 'Hook + Insight + Thread indicator + Hashtags'
      }
    };

    const styleConfig = captionStyles[platform] || captionStyles.tiktok;
    
    // Generate multiple caption options
    const captions = [];
    const captionCount = 3;
    
    for (let i = 0; i < captionCount; i++) {
      const caption = this.generateCaption(platform, styleConfig);
      captions.push({
        id: crypto.randomUUID(),
        platform,
        style,
        text: caption.text,
        hashtags: caption.hashtags,
        word_timestamps: caption.word_timestamps,
        burned_in: false,
        font_settings: {
          family: 'Arial',
          size: 48,
          color: '#FFFFFF',
          outline_color: '#000000',
          outline_width: 2
        },
        position: 'bottom',
        language: 'en',
        status: 'draft'
      });
    }
    
    return captions;
  }

  generateCaption(platform, styleConfig) {
    const hooks = [
      'You won\'t believe what happened next...',
      'This changed everything for me...',
      'Nobody talks about this...',
      'Wait for the ending...',
      'POV: You\'re about to see something crazy',
      'This is why you\'re not growing...',
      'The secret they don\'t want you to know',
      'Stop scrolling - you need to see this'
    ];
    
    const cta = [
      'Follow for more!',
      'Save this for later 💾',
      'Share with a friend who needs this',
      'Comment your thoughts!',
      'Turn on notifications 🔔'
    ];
    
    const hashtagSets = {
      tiktok: ['#fyp', '#viral', '#foryou', '#trending', '#xyzbca'],
      youtube_shorts: ['#shorts', '#viral', '#youtubeshorts', '#trending'],
      instagram_reels: ['#reels', '#reelsinstagram', '#explorepage', '#viral'],
      x: ['#viral', '#trending', '#fyp']
    };
    
    const hook = hooks[Math.floor(Math.random() * hooks.length)];
    const ctaText = this.cta[Math.floor(Math.random() * this.cta.length)];
    const hashtags = hashtagSets[platform] || hashtagSets.tiktok;
    
    return {
      text: `${hook}\n\n${this.generateValue()}\n\n${ctaText}\n\n${hashtags.slice(0, 5).join(' ')}`,
      hashtags: hashtags.slice(0, 5),
      word_timestamps: this.generateWordTimestamps()
    };
  }

  generateValue() {
    const values = [
      'This technique changed my entire approach...',
      'Here\'s exactly what I did...',
      'The results speak for themselves...',
      'Most people miss this crucial step...',
      'Here\'s the breakdown...'
    ];
    return values[Math.floor(Math.random() * values.length)];
  }

  generateWordTimestamps() {
    // Mock word-level timestamps for caption syncing
    const words = ['This', 'is', 'amazing', 'content', 'you', 'need', 'to', 'see'];
    return words.map((word, i) => ({
      word,
      start: i * 0.5,
      end: (i + 1) * 0.5,
      confidence: 0.95
    }));
  }

  getRandomKeywords() {
    const allKeywords = [
      'gaming', 'streaming', 'reaction', 'funny', 'viral', 'trending',
      'tutorial', 'tips', 'tricks', 'guide', 'review', 'gameplay',
      'highlights', 'clips', 'moments', 'best', 'fails', 'wins',
      'educational', 'entertainment', 'comedy', 'reaction', 'commentary'
    ];
    const count = Math.floor(Math.random() * 5) + 3;
    const shuffled = [...allKeywords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  generateMockTranscript() {
    const transcripts = [
      'So I was playing this game and suddenly...',
      'You guys won\'t believe what just happened...',
      'Let me show you the secret technique...',
      'This is actually insane, watch this...',
      'I can\'t believe this actually worked...',
      'Here\'s the strategy that changed everything...'
    ];
    return transcripts[Math.floor(Math.random() * transcripts.length)];
  }

  generateAINotes() {
    const notes = [
      'High engagement potential - strong emotional hook in first 2 seconds',
      'Good retention curve predicted - clear narrative arc',
      'Strong visual hook at 0:03, recommend leading with this frame',
      'Audio quality good, captions will sync well',
      'Viral potential high - relatable content with broad appeal'
    ];
    return notes[Math.floor(Math.random() * notes.length)];
  }

  getRandomKeywords() {
    const allKeywords = [
      'gaming', 'streaming', 'reaction', 'funny', 'viral', 'trending',
      'tutorial', 'tips', 'tricks', 'guide', 'review', 'gameplay',
      'highlights', 'clips', 'moments', 'best', 'fails', 'wins',
      'educational', 'entertainment', 'comedy', 'reaction', 'commentary',
      'strategy', 'guide', 'walkthrough', 'tips', 'tricks', 'secrets'
    ];
    const count = Math.floor(Math.random() * 5) + 3;
    const keywords = ['gaming', 'reaction', 'viral', 'trending', 'funny', 'guide', 'tips', 'streaming'];
    return keywords.sort(() => 0.5 - Math.random()).slice(0, 5);
  }

  generateAINotes() {
    const notes = [
      'High engagement potential - strong emotional hook in first 2 seconds',
      'Good retention curve predicted - clear narrative arc',
      'Strong visual hook at 0:03, recommend leading with this frame',
      'Audio quality good, captions will sync well',
      'Viral potential high - relatable content with broad appeal',
      'Consider adding text overlay at 0:05 for emphasis',
      'Crop tighter on speaker face for mobile viewing',
      'Strong CTA opportunity at 0:12'
    ];
    return notes[Math.floor(Math.random() * notes.length)];
  }

  async scoreHooks(clips, userId) {
    return clips.map(clip => ({
      clip_id: clip.id,
      hook_score: 0.5 + Math.random() * 0.5,
      retention_prediction: 0.5 + Math.random() * 0.5,
      viral_coefficient: 0.5 + Math.random() * 0.5,
      recommended_cta: ['Follow for more!', 'Save this!', 'Share with friends!'][Math.floor(Math.random() * 3)],
      optimal_posting_time: this.getOptimalPostingTime(),
      suggested_hashtags: ['#fyp', '#viral', '#trending', '#foryou', '#xyzbca'].slice(0, 5)
    }));
  }

  getOptimalPostingTime() {
    const hours = [9, 12, 15, 18, 21];
    return `${hours[Math.floor(Math.random() * hours.length)]}:00 EST`;
  }

  async generateVariations(clipId, userId, options = {}) {
    const { count = 3, platforms = ['tiktok', 'youtube_shorts', 'instagram_reels'] } = options;
    
    const variationTypes = [
      { type: 'caption', weight: 0.3 },
      { type: 'crop', weight: 0.25 },
      { type: 'trim', weight: 0.2 },
      { type: 'music', weight: 0.15 },
      { type: 'caption_style', weight: 0.1 }
    ];
    
    const variations = [];
    const variationCount = options.count || 3;
    
    for (let i = 0; i < (options.count || 3); i++) {
      const platform = options.platforms[i % platforms.length];
      const type = this.weightedRandom(variationTypes);
      
      variations.push({
        id: crypto.randomUUID(),
        parent_clip_id: options.clipId,
        variation_type: type.type,
        platform,
        changes: {
          [type.type]: true,
          ...this.getVariationChanges(type.type)
        },
        ai_notes: this.generateVariationNotes(type.type)
      });
    }
    
    return variations;
  }

  getVariationChanges(type) {
    const changes = {
      caption: { caption_text: true, hashtags: true, cta: true },
      crop: { aspect_ratio: '9:16', zoom: '1.1x', position: 'center' },
      trim: { start_trim: '0.5s', end_trim: '0.5s', pacing: 'faster' },
      music: { track: 'trending', volume: '0.3', sync: 'beat' },
      caption_style: { font: 'Montserrat', size: 'larger', animation: 'typewriter', color: 'gradient' }
    };
    return changes[this.variation_type] || {};
  }

  generateVariationNotes(type) {
    const notes = {
      caption: 'New hook-focused caption with trending hashtags',
      crop: 'Vertical 9:16 crop optimized for mobile feed',
      trim: 'Tighter pacing - removed 1.5s dead air',
      music: 'Added trending background track at 30% volume',
      caption_style: 'Dynamic typewriter animation with brand colors'
    };
    return notes[this.variation_type] || 'AI-generated variation';
  }

  weightedRandom(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * total;
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item;
    }
    return items[items.length - 1];
  }
}

export default AIAnalyzer;
