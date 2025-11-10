/**
 * Global Rate Limiter Utility
 * 
 * This module provides a centralized rate limiting mechanism to prevent
 * HTTP 429 (Too Many Requests) errors from the Helius RPC API.
 * 
 * Features:
 * - Queue-based request throttling
 * - Configurable request rate
 * - Automatic retry with exponential backoff
 * - Global coordination across all API calls
 */

interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
}

class RateLimiter {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private lastRequestTime = 0;
  
  // Configuration
  private minDelayBetweenRequests = 250; // Minimum 250ms between requests (4 requests/second)
  private maxRetries = 3;
  private baseRetryDelay = 1000; // Start with 1 second for retries
  
  /**
   * Add a request to the queue
   * @param requestFn Function that executes the API request
   * @returns Promise that resolves with the request result
   */
  async throttle<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: requestFn,
        resolve,
        reject,
        retryCount: 0,
      });
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process queued requests one at a time with rate limiting
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) continue;
      
      try {
        // Ensure minimum delay between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minDelayBetweenRequests) {
          const delay = this.minDelayBetweenRequests - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Execute the request
        this.lastRequestTime = Date.now();
        const result = await request.execute();
        request.resolve(result);
        
      } catch (error: any) {
        // Check if it's a rate limit error
        const errorMsg = error?.message || String(error);
        const isRateLimitError = 
          errorMsg.includes("429") || 
          errorMsg.includes("rate limit") || 
          errorMsg.includes("Too Many Requests");
        
        // Retry rate limit errors with exponential backoff
        if (isRateLimitError && request.retryCount < this.maxRetries) {
          request.retryCount++;
          const retryDelay = this.baseRetryDelay * Math.pow(2, request.retryCount - 1);
          
          console.warn(
            `[RateLimiter] Rate limited (429), retrying in ${retryDelay}ms... ` +
            `(attempt ${request.retryCount}/${this.maxRetries})`
          );
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Add back to the front of the queue for immediate retry
          this.queue.unshift(request);
          
        } else {
          // Max retries reached or non-rate-limit error
          if (isRateLimitError) {
            console.error(
              `[RateLimiter] Rate limit error persists after ${this.maxRetries} retries`
            );
          }
          request.reject(error);
        }
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Update rate limiter configuration
   */
  configure(options: {
    minDelayBetweenRequests?: number;
    maxRetries?: number;
    baseRetryDelay?: number;
  }) {
    if (options.minDelayBetweenRequests !== undefined) {
      this.minDelayBetweenRequests = options.minDelayBetweenRequests;
    }
    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }
    if (options.baseRetryDelay !== undefined) {
      this.baseRetryDelay = options.baseRetryDelay;
    }
  }
  
  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
  
  /**
   * Check if rate limiter is currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Wrapper for Connection RPC methods with rate limiting
 */
export function withRateLimit<T>(requestFn: () => Promise<T>): Promise<T> {
  return rateLimiter.throttle(requestFn);
}

