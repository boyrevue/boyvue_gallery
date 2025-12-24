/**
 * Media Service
 * Handles image and video processing, storage, and delivery
 * All processing settings derived from TTL configuration
 */

import { getConfigService } from './config-service.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * Media Service Class
 */
class MediaService {
  constructor() {
    this.config = null;
    this.imageConfig = null;
    this.videoConfig = null;
    this.storageConfig = null;
  }

  /**
   * Initialize from configuration service
   */
  initialize() {
    const configService = getConfigService();
    const appConfig = configService.getAppConfig();
    
    // These would come from app.ttl
    this.storageConfig = {
      type: process.env.STORAGE_TYPE || 'local',
      localPath: '/var/www/gallery/media',
      cdnUrl: process.env.CDN_URL || '',
      maxUploadSize: 104857600, // 100MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime'
      ]
    };

    this.imageConfig = {
      thumbnailSizes: [
        { name: 'thumb', width: 200, height: 200, fit: 'cover' },
        { name: 'small', width: 400, height: 400, fit: 'inside' },
        { name: 'medium', width: 800, height: 800, fit: 'inside' },
        { name: 'large', width: 1600, height: 1600, fit: 'inside' },
        { name: 'full', width: 2400, height: 2400, fit: 'inside' }
      ],
      outputFormat: 'webp',
      quality: 85,
      stripMetadata: true,
      watermark: {
        enabled: process.env.WATERMARK_ENABLED === 'true',
        path: '/assets/watermark.png',
        position: 'bottom-right',
        opacity: 0.5
      }
    };

    this.videoConfig = {
      transcodeEnabled: true,
      outputFormats: ['mp4', 'webm'],
      resolutions: [
        { name: '360p', height: 360, bitrate: '800k' },
        { name: '480p', height: 480, bitrate: '1500k' },
        { name: '720p', height: 720, bitrate: '3000k' },
        { name: '1080p', height: 1080, bitrate: '6000k' }
      ],
      hlsEnabled: true,
      thumbnailCount: 10,
      previewGif: {
        enabled: true,
        duration: 5,
        fps: 10,
        width: 320
      }
    };
  }

  /**
   * Process uploaded image
   */
  async processImage(inputPath, options = {}) {
    const sharp = (await import('sharp')).default;
    
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    
    const results = {
      original: {
        path: inputPath,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: (await fs.stat(inputPath)).size
      },
      thumbnails: {},
      processed: null
    };

    // Generate unique filename
    const fileHash = await this.generateFileHash(inputPath);
    const baseName = fileHash;

    // Process main image
    const processedPath = await this.processMainImage(inputPath, baseName, options);
    results.processed = processedPath;

    // Generate thumbnails
    for (const size of this.imageConfig.thumbnailSizes) {
      const thumbPath = await this.generateThumbnail(inputPath, baseName, size);
      results.thumbnails[size.name] = thumbPath;
    }

    return results;
  }

  /**
   * Process main image (optimize, watermark, convert)
   */
  async processMainImage(inputPath, baseName, options = {}) {
    const sharp = (await import('sharp')).default;
    
    const outputFormat = options.format || this.imageConfig.outputFormat;
    const outputPath = path.join(
      this.storageConfig.localPath,
      'images',
      `${baseName}.${outputFormat}`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    let pipeline = sharp(inputPath);

    // Strip metadata if configured
    if (this.imageConfig.stripMetadata) {
      pipeline = pipeline.rotate(); // Auto-rotate based on EXIF, then strip
    }

    // Apply watermark if enabled
    if (this.imageConfig.watermark.enabled && options.watermark !== false) {
      pipeline = await this.applyWatermark(pipeline);
    }

    // Convert to output format
    switch (outputFormat) {
      case 'webp':
        pipeline = pipeline.webp({ quality: this.imageConfig.quality });
        break;
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality: this.imageConfig.quality });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
    }

    await pipeline.toFile(outputPath);

    return {
      path: outputPath,
      url: this.getPublicUrl(outputPath)
    };
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(inputPath, baseName, size) {
    const sharp = (await import('sharp')).default;
    
    const outputPath = path.join(
      this.storageConfig.localPath,
      'thumbnails',
      size.name,
      `${baseName}.webp`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await sharp(inputPath)
      .resize(size.width, size.height, {
        fit: size.fit,
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return {
      path: outputPath,
      url: this.getPublicUrl(outputPath),
      width: size.width,
      height: size.height
    };
  }

  /**
   * Apply watermark to image
   */
  async applyWatermark(pipeline) {
    const sharp = (await import('sharp')).default;
    
    const watermarkPath = this.imageConfig.watermark.path;
    
    try {
      const watermark = await sharp(watermarkPath)
        .ensureAlpha(this.imageConfig.watermark.opacity)
        .toBuffer();

      return pipeline.composite([{
        input: watermark,
        gravity: this.getGravity(this.imageConfig.watermark.position)
      }]);
    } catch (error) {
      console.warn('Failed to apply watermark:', error.message);
      return pipeline;
    }
  }

  /**
   * Get sharp gravity from position string
   */
  getGravity(position) {
    const gravityMap = {
      'top-left': 'northwest',
      'top': 'north',
      'top-right': 'northeast',
      'left': 'west',
      'center': 'center',
      'right': 'east',
      'bottom-left': 'southwest',
      'bottom': 'south',
      'bottom-right': 'southeast'
    };
    return gravityMap[position] || 'southeast';
  }

  /**
   * Process uploaded video
   */
  async processVideo(inputPath, options = {}) {
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    const results = {
      original: {
        path: inputPath,
        size: (await fs.stat(inputPath)).size
      },
      transcoded: {},
      thumbnails: [],
      previewGif: null,
      hls: null
    };

    // Get video metadata
    const metadata = await this.getVideoMetadata(inputPath);
    results.original = { ...results.original, ...metadata };

    // Generate unique filename
    const fileHash = await this.generateFileHash(inputPath);
    const baseName = fileHash;

    // Transcode to different resolutions
    if (this.videoConfig.transcodeEnabled) {
      for (const resolution of this.videoConfig.resolutions) {
        // Skip if source is smaller than target
        if (metadata.height < resolution.height) continue;

        for (const format of this.videoConfig.outputFormats) {
          const transcodedPath = await this.transcodeVideo(
            inputPath, 
            baseName, 
            resolution, 
            format
          );
          
          if (!results.transcoded[resolution.name]) {
            results.transcoded[resolution.name] = {};
          }
          results.transcoded[resolution.name][format] = transcodedPath;
        }
      }
    }

    // Generate thumbnails
    results.thumbnails = await this.generateVideoThumbnails(inputPath, baseName);

    // Generate preview GIF
    if (this.videoConfig.previewGif.enabled) {
      results.previewGif = await this.generatePreviewGif(inputPath, baseName);
    }

    // Generate HLS stream
    if (this.videoConfig.hlsEnabled) {
      results.hls = await this.generateHLSStream(inputPath, baseName);
    }

    return results;
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(inputPath) {
    const ffprobe = (await import('fluent-ffmpeg')).default;
    
    return new Promise((resolve, reject) => {
      ffprobe.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: eval(videoStream?.r_frame_rate) || 30,
          codec: videoStream?.codec_name,
          bitrate: metadata.format.bit_rate,
          hasAudio: !!audioStream
        });
      });
    });
  }

  /**
   * Transcode video to specific resolution and format
   */
  async transcodeVideo(inputPath, baseName, resolution, format) {
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    const outputPath = path.join(
      this.storageConfig.localPath,
      'videos',
      resolution.name,
      `${baseName}.${format}`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .size(`?x${resolution.height}`)
        .videoBitrate(resolution.bitrate)
        .audioCodec('aac')
        .audioBitrate('128k');

      if (format === 'mp4') {
        command = command
          .videoCodec('libx264')
          .outputOptions(['-preset fast', '-crf 23', '-movflags +faststart']);
      } else if (format === 'webm') {
        command = command
          .videoCodec('libvpx-vp9')
          .outputOptions(['-crf 30', '-b:v 0']);
      }

      command
        .output(outputPath)
        .on('end', () => {
          resolve({
            path: outputPath,
            url: this.getPublicUrl(outputPath)
          });
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Generate video thumbnails
   */
  async generateVideoThumbnails(inputPath, baseName) {
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    const outputDir = path.join(
      this.storageConfig.localPath,
      'videos',
      'thumbnails',
      baseName
    );

    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: this.videoConfig.thumbnailCount,
          folder: outputDir,
          filename: 'thumb_%i.jpg',
          size: '640x360'
        })
        .on('end', async () => {
          const thumbnails = [];
          for (let i = 1; i <= this.videoConfig.thumbnailCount; i++) {
            const thumbPath = path.join(outputDir, `thumb_${i}.jpg`);
            thumbnails.push({
              path: thumbPath,
              url: this.getPublicUrl(thumbPath)
            });
          }
          resolve(thumbnails);
        })
        .on('error', reject);
    });
  }

  /**
   * Generate preview GIF
   */
  async generatePreviewGif(inputPath, baseName) {
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    const config = this.videoConfig.previewGif;
    const outputPath = path.join(
      this.storageConfig.localPath,
      'videos',
      'previews',
      `${baseName}.gif`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(0)
        .duration(config.duration)
        .outputOptions([
          `-vf scale=${config.width}:-1:flags=lanczos,fps=${config.fps}`,
          '-gifflags +transdiff'
        ])
        .output(outputPath)
        .on('end', () => {
          resolve({
            path: outputPath,
            url: this.getPublicUrl(outputPath)
          });
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Generate HLS stream
   */
  async generateHLSStream(inputPath, baseName) {
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    
    const outputDir = path.join(
      this.storageConfig.localPath,
      'videos',
      'hls',
      baseName
    );

    await fs.mkdir(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          '-hls_time 10',
          '-hls_list_size 0',
          '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts')
        ])
        .output(playlistPath)
        .on('end', () => {
          resolve({
            path: playlistPath,
            url: this.getPublicUrl(playlistPath)
          });
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Generate file hash for unique naming
   */
  async generateFileHash(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16);
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(filePath) {
    const relativePath = path.relative(this.storageConfig.localPath, filePath);
    
    if (this.storageConfig.cdnUrl) {
      return `${this.storageConfig.cdnUrl}/${relativePath}`;
    }
    
    return `/media/${relativePath}`;
  }

  /**
   * Validate upload file
   */
  validateUpload(file) {
    const errors = [];

    // Check file size
    if (file.size > this.storageConfig.maxUploadSize) {
      errors.push(`File size exceeds maximum allowed (${this.formatBytes(this.storageConfig.maxUploadSize)})`);
    }

    // Check MIME type
    if (!this.storageConfig.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type not allowed: ${file.mimetype}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if file is image
   */
  isImage(mimeType) {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if file is video
   */
  isVideo(mimeType) {
    return mimeType.startsWith('video/');
  }

  /**
   * Delete media and all derivatives
   */
  async deleteMedia(baseName) {
    const paths = [
      path.join(this.storageConfig.localPath, 'images', `${baseName}.*`),
      path.join(this.storageConfig.localPath, 'thumbnails', '*', `${baseName}.*`),
      path.join(this.storageConfig.localPath, 'videos', '*', `${baseName}.*`),
      path.join(this.storageConfig.localPath, 'videos', 'hls', baseName)
    ];

    // This would need glob matching in real implementation
    for (const p of paths) {
      try {
        await fs.rm(p, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors for non-existent files
      }
    }
  }
}

// Singleton instance
let mediaInstance = null;

/**
 * Get media service instance
 */
export function getMediaService() {
  if (!mediaInstance) {
    mediaInstance = new MediaService();
    mediaInstance.initialize();
  }
  return mediaInstance;
}

export { MediaService };
export default { getMediaService, MediaService };
