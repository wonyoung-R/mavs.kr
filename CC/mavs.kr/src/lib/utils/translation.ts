// src/lib/utils/translation.ts
import * as deepl from 'deepl-node';

// DeepL translator instance
let translator: deepl.Translator | null = null;

function getTranslator(): deepl.Translator {
  if (!translator) {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPL_API_KEY environment variable is required');
    }
    translator = new deepl.Translator(apiKey);
  }
  return translator;
}

/**
 * Translate text using DeepL API
 */
export async function translateContent(
  text: string,
  targetLang: deepl.TargetLanguageCode = 'ko'
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  try {
    const translator = getTranslator();

    // DeepL has a character limit, so we need to split long texts
    const MAX_LENGTH = 5000;

    if (text.length <= MAX_LENGTH) {
      const result = await translator.translateText(text, null, targetLang);
      return result.text;
    }

    // Split long text into chunks
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += MAX_LENGTH) {
      chunks.push(text.slice(i, i + MAX_LENGTH));
    }

    // Translate each chunk
    const translatedChunks = await Promise.all(
      chunks.map(chunk => translator.translateText(chunk, null, targetLang))
    );

    return translatedChunks.map(result => result.text).join(' ');
  } catch (error) {
    console.error('DeepL translation failed:', error);

    // Fallback to Google Translate if DeepL fails
    return await translateWithGoogle(text, targetLang);
  }
}

/**
 * Fallback translation using Google Translate
 */
async function translateWithGoogle(
  text: string,
  targetLang: string = 'ko'
): Promise<string> {
  try {
    const { Translate } = await import('@google-cloud/translate/build/src/v2');

    const translate = new Translate({
      key: process.env.GOOGLE_TRANSLATE_API_KEY,
    });

    const [translation] = await translate.translate(text, targetLang);
    return translation;
  } catch (error) {
    console.error('Google Translate fallback failed:', error);
    return text; // Return original text if all translation methods fail
  }
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<string> {
  try {
    const translator = getTranslator();
    const result = await translator.translateText(text, null, 'en-US');
    return result.detectedSourceLang;
  } catch (error) {
    console.error('Language detection failed:', error);
    return 'en'; // Default to English
  }
}

/**
 * Translate multiple texts in batch
 */
export async function translateBatch(
  texts: string[],
  targetLang: deepl.TargetLanguageCode = 'ko'
): Promise<string[]> {
  try {
    const translator = getTranslator();

    // DeepL supports batch translation
    const results = await Promise.all(
      texts.map(text => translateContent(text, targetLang))
    );

    return results;
  } catch (error) {
    console.error('Batch translation failed:', error);
    return texts; // Return original texts if translation fails
  }
}

/**
 * Translate with caching to avoid repeated API calls
 */
const translationCache = new Map<string, string>();

export async function translateWithCache(
  text: string,
  targetLang: deepl.TargetLanguageCode = 'ko'
): Promise<string> {
  const cacheKey = `${text}-${targetLang}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const translated = await translateContent(text, targetLang);
  translationCache.set(cacheKey, translated);

  // Limit cache size
  if (translationCache.size > 1000) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) {
      translationCache.delete(firstKey);
    }
  }

  return translated;
}
