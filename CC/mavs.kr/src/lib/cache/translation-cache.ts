// src/lib/cache/translation-cache.ts
interface CacheEntry {
  translated: string;
  timestamp: number;
  source: string;
}

class TranslationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

  private generateKey(text: string): string {
    // 텍스트를 안전하게 해시화하여 키 생성
    try {
      // 특수 문자를 제거하고 안전한 문자열로 변환
      const safeText = text.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
      return btoa(encodeURIComponent(safeText)).replace(/[^a-zA-Z0-9]/g, '');
    } catch {
      // 해시 생성 실패 시 간단한 키 생성
      return text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
    }
  }

  get(text: string): string | null {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 캐시 만료 확인
    if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.translated;
  }

  set(text: string, translated: string): void {
    const key = this.generateKey(text);
    this.cache.set(key, {
      translated,
      timestamp: Date.now(),
      source: text
    });
  }

  // 로컬 스토리지에서 캐시 로드 (클라이언트 사이드에서만)
  loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('translation-cache');
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([key, entry]: [string, any]) => {
          // 만료된 항목은 제외
          if (Date.now() - entry.timestamp < this.CACHE_DURATION) {
            this.cache.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load translation cache:', error);
    }
  }

  // 로컬 스토리지에 캐시 저장 (클라이언트 사이드에서만)
  saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem('translation-cache', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save translation cache:', error);
    }
  }

  // 캐시 크기 제한 (최대 100개 항목)
  private cleanup(): void {
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // 오래된 항목들 제거
      const toRemove = entries.slice(0, entries.length - 100);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }
}

export const translationCache = new TranslationCache();
