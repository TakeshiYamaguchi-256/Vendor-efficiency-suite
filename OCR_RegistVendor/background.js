// background.js
// Gemini APIを使用したOCR実装

// バックグラウンドスクリプト内の状態
let isProcessingCancelled = false;
let currentProcessingTabId = null;

const activeProcessing = new Set(); // 処理中のタブIDを管理

function isTabProcessing(tabId) {
  return activeProcessing.has(tabId);
}

function setTabProcessing(tabId, processing) {
  if (processing) {
    activeProcessing.add(tabId);
  } else {
    activeProcessing.delete(tabId);
  }
}

// セキュアなAPIキー管理クラス
class SecureAPIKeyManager {
  constructor() {
    this.hashedKey = null;
  }
  
  // APIキーを検証するが露出しない
  async validateKey() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    return !!(result.geminiApiKey && result.geminiApiKey.startsWith('AIza'));
  }
  
  // APIキーの存在のみを確認
  async keyExists() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    return !!(result.geminiApiKey && result.geminiApiKey.length > 10);
  }
  
  // APIキーを安全に取得（バックグラウンドスクリプト内でのみ使用）
  async getKey() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    return result.geminiApiKey || null;
  }
}

const secureKeyManager = new SecureAPIKeyManager();

// 設定のキャッシュ - グローバル変数として初期化
let cachedSettings = {
  apiKey: null,
  language: 'ja', 
  mode: 'accurate',
  model: 'gemini-2.0-flash',
  lastUpdate: 0
};

// 設定のキャッシュ
async function getCachedSettings() {
  const result = await chrome.storage.session.get(['cachedSettings']);
  return result.cachedSettings || {
    apiKey: null,
    language: 'ja', 
    mode: 'accurate',
    model: 'gemini-2.0-flash',
    lastUpdate: 0
  };
}

async function setCachedSettings(settings) {
  await chrome.storage.session.set({cachedSettings: settings});
}


// 設定を読み込む関数
async function loadSettings() {
  try {
    // 最後の更新から30秒以内ならキャッシュを使用
    if (cachedSettings && cachedSettings.lastUpdate && 
        Date.now() - cachedSettings.lastUpdate < 30000 && 
        cachedSettings.apiKey) {
      return cachedSettings;
    }
    
    const result = await chrome.storage.local.get(['geminiApiKey', 'ocrLanguage', 'ocrMode', 'geminiModel']);
    
    cachedSettings = {
      apiKey: result.geminiApiKey || null,
      language: result.ocrLanguage || 'ja',
      mode: result.ocrMode || 'accurate',
      model: result.geminiModel || 'gemini-2.0-flash',
      lastUpdate: Date.now()
    };
    
    return cachedSettings;
  } catch (error) {
    console.error('設定読み込みエラー:', error);
    // エラー時はデフォルト値を返す
    return {
      apiKey: null,
      language: 'ja',
      mode: 'accurate',
      model: 'gemini-2.0-flash',
      lastUpdate: Date.now()
    };
  }
}



function safeTabMessage(tabId, message, callback = null) {
  if (!tabId) {
    console.warn('無効なタブIDです');
    if (callback) callback(false);
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    // タブの存在確認
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.log(`タブ${tabId}は存在しません:`, chrome.runtime.lastError.message);
        if (callback) callback(false);
        resolve(false);
        return;
      }
      
      // メッセージ送信
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`タブ${tabId}への送信失敗:`, chrome.runtime.lastError.message);
          if (callback) callback(false);
          resolve(false);
        } else {
          if (callback) callback(response);
          resolve(response);
        }
      });
    });
  });
}


/**
 * アンシャープマスクフィルタを適用して画像をシャープにする
 * 特にテキスト認識に有用
 */
function applyUnsharpMask(data, width, height, amount = 0.6, radius = 0.5, threshold = 0) {
  // これは簡略版 - 完全な実装はもっと複雑
  // 元のデータのコピーを作成
  const result = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i];
  }
  
  // ぼかしとアンシャープマスクを適用
  // 理想的にはガウスぼかしアルゴリズムを使用
  // この例では単純なボックスぼかしを使用
  
  // エッジではない各ピクセルに対して
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGBチャンネルのみ
        const idx = (y * width + x) * 4 + c;
        
        // ローカル平均を計算（単純なボックスぼかし）
        const avg = (
          data[idx - width * 4 - 4] + data[idx - width * 4] + data[idx - width * 4 + 4] +
          data[idx - 4] + data[idx] + data[idx + 4] +
          data[idx + width * 4 - 4] + data[idx + width * 4] + data[idx + width * 4 + 4]
        ) / 9;
        
        // 差分を計算
        const diff = data[idx] - avg;
        
        // 差分が閾値を超える場合のみ適用
        if (Math.abs(diff) > threshold) {
          result[idx] = clamp(data[idx] + diff * amount);
        }
      }
    }
  }
  
  return result;
}









/**
 * APIリクエストキューイング機構
 */
class APIRequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequest = 0;
    this.minInterval = 500; // 0.5秒間隔
  }
  
  async execute(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const { requestFn, resolve, reject } = this.queue.shift();
    
    try {
      // 最小間隔を確保
      const elapsed = Date.now() - this.lastRequest;
      if (elapsed < this.minInterval) {
        await new Promise(r => setTimeout(r, this.minInterval - elapsed));
      }
      
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.lastRequest = Date.now();
      this.processing = false;
      // 次のキュー処理を少し遅延させる
      setTimeout(() => this.processQueue(), 50);
    }
  }
  
  getQueueLength() {
    return this.queue.length;
  }
}

// グローバルキューインスタンス
const apiRequestQueue = new APIRequestQueue();

/**
 * 画像データサイズをチェックする関数
 * @param {string} dataUrl - 画像のデータURL
 * @returns {number} - 画像サイズ（MB）
 * @throws {Error} - サイズが制限を超える場合
 */
function checkImageSize(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('無効な画像データです');
  }
  
  // Base64データからサイズを推定（MB単位）
  const base64 = dataUrl.split(',')[1] || '';
  const sizeInMB = (base64.length * 0.75) / (1024 * 1024);
  
  const MAX_SIZE_MB = 15; // 15MBまで（Gemini APIの制限を考慮）
  
  console.log(`画像サイズ: ${sizeInMB.toFixed(2)}MB`);
  
  if (sizeInMB > MAX_SIZE_MB) {
    throw new Error(`画像サイズが大きすぎます（${sizeInMB.toFixed(1)}MB）。${MAX_SIZE_MB}MB以下にしてください。`);
  }
  
  return sizeInMB;
}

/**
 * 画像を自動圧縮する関数
 * @param {string} imageData - 元の画像データ
 * @param {number} targetSizeMB - 目標サイズ（MB）
 * @returns {Promise<string>} - 圧縮された画像データ
 */
async function compressImageToSize(imageData, targetSizeMB = 10) {
  console.log('画像を自動圧縮しています...');
  
  // 段階的に品質を下げて圧縮
  const qualityLevels = [0.8, 0.6, 0.4, 0.3];
  const dimensionLimits = [1400, 1200, 1000, 800];
  
  for (let i = 0; i < qualityLevels.length; i++) {
    try {
      const compressedImage = await optimizeImage(imageData, {
        quality: qualityLevels[i],
        maxDimension: dimensionLimits[i],
        enhanceText: true,
        contrast: 1.1
      });
      
      // 圧縮後のサイズをチェック
      const base64 = compressedImage.split(',')[1] || '';
      const sizeInMB = (base64.length * 0.75) / (1024 * 1024);
      
      console.log(`圧縮レベル${i + 1}: ${sizeInMB.toFixed(2)}MB (品質: ${qualityLevels[i]}, 最大寸法: ${dimensionLimits[i]})`);
      
      if (sizeInMB <= targetSizeMB) {
        console.log('画像圧縮が完了しました');
        return compressedImage;
      }
    } catch (error) {
      console.warn(`圧縮レベル${i + 1}でエラー:`, error);
      continue;
    }
  }
  
  throw new Error('画像サイズを十分に圧縮できませんでした。より小さな領域を選択してください。');
}

/**
 * Gemini APIを使用してテキストを抽出する関数（強化版）
 * @param {string} imageData - Base64エンコードされた画像データ
 * @param {Object} options - 抽出オプション
 * @returns {Promise<Object>} - 抽出結果
 */
async function extractTextWithGemini(imageData, options = {}) {
  // キューイング機構を使用してAPI呼び出しを制御
  return apiRequestQueue.execute(async () => {
    console.log(`APIキュー実行開始 (待機中: ${apiRequestQueue.getQueueLength()}件)`);
    
    // リトライ設定
    const MAX_RETRIES = 1;
    
    // 引数の検証
    if (!imageData || !imageData.startsWith('data:image/')) {
      throw new Error('無効な画像データです');
    }
    
    // 画像サイズチェックと自動圧縮
    let processedImageData = imageData;
    try {
      checkImageSize(imageData);
      console.log('画像サイズチェック: OK');
    } catch (sizeError) {
      if (sizeError.message.includes('画像サイズが大きすぎます')) {
        console.log('画像サイズが大きいため自動圧縮を実行します');
        try {
          processedImageData = await compressImageToSize(imageData, 10);
          // 圧縮後に再度サイズチェック
          checkImageSize(processedImageData);
        } catch (compressionError) {
          throw new Error(`画像圧縮エラー: ${compressionError.message}`);
        }
      } else {
        throw sizeError;
      }
    }
    
    // 設定を取得
    const settings = await loadSettings();
    const apiKey = settings.apiKey;
    const model = options.model || settings.model || 'gemini-2.0-flash';
    
    if (!apiKey) {
      throw new Error('APIキーが設定されていません');
    }
    
    // Base64エンコードされた画像からヘッダー部分を削除
    const base64Image = processedImageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
    // 言語や処理モードの設定
    const { language = settings.language, mode = settings.mode, fieldType = null } = options;
    
    // モデル名に基づいてエンドポイントを決定
    const modelEndpoint = model.trim().replace(/\s+/g, '-');
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${apiKey}`;
    
    // モデルごとに最適なプロンプトを取得
    const promptText = getPromptForModel(model, language, mode, fieldType);
    
    // リトライループ
    let attempt = 0;
    let lastError = null;
    
    while (attempt <= MAX_RETRIES) {
      try {
        console.log(`Gemini API呼び出し開始 (試行 ${attempt + 1}/${MAX_RETRIES + 1})`);
        
        // リクエストボディの作成
        const requestBody = {
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
          }],
          generation_config: {
            temperature: 0.05,
            top_p: 0.97,
            response_mime_type: "text/plain"
          }
        };
        
        // APIリクエストを送信（タイムアウト制御付き）
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('APIリクエストがタイムアウトしました')), 15000); // 15秒に延長
        });
        
        const fetchPromise = fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        // どちらか早い方を採用
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        // レスポンスを処理
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Gemini API エラー:', errorData);
          
          let errorMessage = 'APIリクエストに失敗しました';
          
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          } else if (typeof errorData === 'object') {
            try {
              errorMessage = JSON.stringify(errorData);
            } catch (e) {
              errorMessage = 'APIエラー: 詳細不明';
            }
          }
          
          // レート制限エラーやサーバー負荷エラーの場合はリトライ
          if (
            errorMessage.includes('overloaded') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('server error') ||
            errorMessage.includes('try again') ||
            response.status === 429 || 
            response.status >= 500
          ) {
            throw new Error(`一時的なAPI制限: ${errorMessage}`);
          }
          
          throw new Error(`API エラー: ${errorMessage}`);
        }
        
        const data = await response.json();
        
        // レスポンスからテキストを抽出
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log('Gemini API呼び出し成功');
          return {
            text: data.candidates[0].content.parts[0].text,
            confidence: 0.95,
            imageCompressed: processedImageData !== imageData // 圧縮されたかどうか
          };
        } else {
          throw new Error('テキストを抽出できませんでした');
        }
      } catch (error) {
        console.error(`テキスト抽出エラー (リトライ ${attempt + 1}/${MAX_RETRIES + 1}):`, error);
        
        // 一時的なエラーの場合のみリトライ
        const isTemporaryError = error.message && (
          error.message.includes('一時的なAPI制限') || 
          error.message.includes('overloaded') ||
          error.message.includes('rate limit') ||
          error.message.includes('timeout') ||
          error.message.includes('タイムアウト')
        );
        
        if (isTemporaryError && attempt < MAX_RETRIES) {
          lastError = error;
          attempt++;
          
          // キューイング機構により既に間隔制御されているため、リトライ遅延は短縮
          const retryDelay = 1000 * Math.pow(1.5, attempt - 1);
          console.log(`${retryDelay}ms後にリトライします...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          // 一時的でないエラーまたはリトライ回数超過
          throw error;
        }
      }
    }
    
    // すべてのリトライが失敗した場合
    throw new Error(`Gemini APIへのリクエストが失敗しました。最後のエラー: ${lastError ? lastError.message : '不明なエラー'}`);
  });
}

/**
 * モデルごとに適切なプロンプトを返す関数
 * @param {string} model - 使用するモデル名
 * @param {string} language - 言語設定
 * @param {string} mode - OCRモード
 * @param {string} fieldType - フィールドタイプ
 * @returns {string} プロンプトテキスト
 */
function getPromptForModel(model, language, mode, fieldType) {
  // Gemini 2.5 Flash用のプロンプト（最新の最適化版）
  if (model === 'gemini-2.5-flash') {
    if (fieldType === 'phone-number') {
      return `画像に含まれる電話番号を正確に抽出してください。以下の要件に従ってください：
- 数字、ハイフン、カンマのみを返してください（例: 03-1234-5678）
- 複数の電話番号があればカンマで区切って全て抽出してください
- Tで始まる13桁の事業者番号は無視してください
- 国際的な標準形式（+81）も適切に処理してください
- 余計な説明や文字は不要です`;
    } else if (fieldType === 'payee-name') {
      return `画像から以下を抽出してください:
1. 会社名: 法人格(株式会社など)と支店名を除いた正確な名称。ひらがな・カタカナ・漢字などを正確に区別し、複数ある場合はカンマ区切り。
2. 電話番号: ハイフン含む完全な番号。複数ある場合はカンマ区切り。T始まりの13桁事業者番号は除外。

形式:
会社名: [抽出結果]
電話番号: [抽出結果]

画像の解像度が低くても最大限正確に読み取ってください。検出できない項目は空欄にしてください。`;
    } else {
      return `以下の画像に含まれるテキストを抽出してください。言語は${language === 'ja' ? '日本語' : language === 'en' ? '英語' : '複数言語'}です。
${mode === 'accurate' ? '文字の形や特徴を細かく観察し、文脈を考慮して正確に認識してください。特に小さな文字や低コントラストの文字も注意深く認識してください。似た文字（例：「り」と「リ」、「0」と「O」、「l」と「1」など）は文脈から判断して区別してください。' : ''}
レイアウトは無視して純粋なテキストのみを出力してください。`;
    }
  }else if (model === 'gemini-2.0-flash-lite') {
    if (fieldType === 'phone-number') {
      return `画像内の電話番号を正確に抽出してください。数字、ハイフン、カンマのみを返してください。例: 03-1234-5678。
複数の電話番号があれば、カンマで区切って全て抽出してください。
余計な説明や文字は不要です。Tで始まる13桁の事業者番号は無視してください。
国際的な標準形式（+81）も適切に処理してください。`;
    } else if (fieldType === 'payee-name') {
      return `画像から以下を抽出してください:
1. 会社名: 法人格(株式会社など)と支店名を除いた正確な名称。ひらがな・カタカナ・漢字などを正確に区別し、複数ある場合はカンマ区切り。
2. 電話番号: ハイフン含む完全な番号。複数ある場合はカンマ区切り。T始まりの13桁事業者番号は除外。

形式:
会社名: [抽出結果]
電話番号: [抽出結果]

画像の解像度が低くても最大限正確に読み取ってください。検出できない項目は空欄にしてください。`;
    } else {
      return `以下の画像に含まれるテキストを抽出してください。言語は${language === 'ja' ? '日本語' : language === 'en' ? '英語' : '複数言語'}です。
文字の形や特徴を細かく観察し、文脈を考慮して正確に認識してください。特に小さな文字や低コントラストの文字も注意深く認識してください。
似た文字（例：「り」と「リ」、「0」と「O」、「l」と「1」など）は文脈から判断して区別してください。
レイアウトは無視して純粋なテキストのみを出力してください。`;
    }
  }
  // Gemini 1.5 Flash用のプロンプト
  else if (model === 'gemini-1.5-flash') {
    if (fieldType === 'phone-number') {
      return `画像内の電話番号を正確に抽出してください。数字、ハイフン、カンマのみを返してください。例: 03-1234-5678。
複数の電話番号があれば、カンマで区切って全て抽出してください。
余計な説明や文字は不要です。Tで始まる13桁の事業者番号は無視してください。
国際的な標準形式（+81）も適切に処理してください。`;
    } else if (fieldType === 'payee-name') {
      return `画像から以下を抽出してください:
1. 会社名: 法人格(株式会社など)と支店名を除いた正確な名称。ひらがな・カタカナ・漢字などを正確に区別し、複数ある場合はカンマ区切り。
2. 電話番号: ハイフン含む完全な番号。複数ある場合はカンマ区切り。T始まりの13桁事業者番号は除外。

形式:
会社名: [抽出結果]
電話番号: [抽出結果]

画像の解像度が低くても最大限正確に読み取ってください。検出できない項目は空欄にしてください。`;
    } else {
      return `以下の画像に含まれるテキストを抽出してください。言語は${language === 'ja' ? '日本語' : language === 'en' ? '英語' : '複数言語'}です。
文字の形や特徴を細かく観察し、文脈を考慮して正確に認識してください。特に小さな文字や低コントラストの文字も注意深く認識してください。
似た文字（例：「り」と「リ」、「0」と「O」、「l」と「1」など）は文脈から判断して区別してください。
レイアウトは無視して純粋なテキストのみを出力してください。`;
    }
  }
  // Gemini 2.0 Flash用のプロンプト
  else if (model === 'gemini-2.0-flash') {
    if (fieldType === 'phone-number') {
      return `画像に含まれる電話番号のみを正確に抽出し、複数候補があるときはカンマで区切り、数字、ハイフン、カンマのみを返してください。例: 03-1234-5678。それ以外の文字や説明は不要です。Tで始まる13桁の事業者番号は無視してください。`;
    } else if (fieldType === 'payee-name') {
      return `画像から以下を抽出してください:
1. 会社名: 法人格(株式会社など)と支店名を除いた正確な名称。ひらがな・カタカナ・漢字などを正確に区別し、複数ある場合はカンマ区切り。
2. 電話番号: ハイフン含む完全な番号。複数ある場合はカンマ区切り。T始まりの13桁事業者番号は除外。

形式:
会社名: [抽出結果]
電話番号: [抽出結果]

検出できない項目は空欄にしてください。`;
    } else {
      return `以下の画像に含まれるテキストを抽出してください。言語は${language === 'ja' ? '日本語' : language === 'en' ? '英語' : '複数言語'}です。
${mode === 'accurate' ? '文字の形や特徴を細かく観察し、文脈を考慮して正確に認識してください。特に似た文字（例：「り」と「リ」、「0」と「O」）を区別してください。' : ''}
レイアウトは無視して純粋なテキストのみを出力してください。`;
    }
  }
  // その他のモデルやデフォルトのプロンプト
  else {
    if (fieldType === 'phone-number') {
      return `画像に含まれる電話番号のみを正確に抽出し、複数候補があるときはカンマで区切り、数字、ハイフン、カンマのみを返してください。例: 03-1234-5678。それ以外の文字や説明は不要です。Tで始まる13桁の事業者番号は無視してください。`;
    } else if (fieldType === 'payee-name') {
      return `画像から以下を抽出してください:
1. 会社名: 法人格(株式会社など)と支店名を除いた正確な名称。複数ある場合はカンマ区切り。
2. 電話番号: ハイフン含む完全な番号。複数ある場合はカンマ区切り。T始まりの13桁事業者番号は除外。

形式:
会社名: [抽出結果]
電話番号: [抽出結果]

検出できない項目は空欄にしてください。`;
    } else {
      return `以下の画像に含まれるテキストを抽出してください。言語は${language === 'ja' ? '日本語' : language === 'en' ? '英語' : '複数言語'}です。
${mode === 'accurate' ? '文字の形や特徴を細かく観察し、文脈を考慮して正確に認識してください。特に似た文字（例：「り」と「リ」、「0」と「O」）を区別してください。' : ''}
純粋に認識されたテキストのみを出力し、余計な説明は不要です。`;
    }
  }
}
// エラーメッセージを改善するヘルパー関数
function getReadableErrorMessage(error) {
  if (!error) return 'エラーが発生しました';
  
  const errorMessage = error.message || error.toString();
  
  // 一般的なエラーパターンに対するユーザーフレンドリーなメッセージ
  if (errorMessage.includes('overloaded') || errorMessage.includes('一時的なAPI制限')) {
    return 'Google Gemini APIが混雑しています。しばらく待ってから再試行してください。';
  }
  
  if (errorMessage.includes('rate limit')) {
    return 'APIの利用制限に達しました。しばらく待ってから再試行してください。';
  }
  
  if (errorMessage.includes('invalid API key') || errorMessage.includes('APIキーが設定されていません')) {
    return 'APIキーが無効です。設定から正しいGemini APIキーを入力してください。';
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
  }
  
  // デフォルトのエラーメッセージ
  return `エラー: ${errorMessage}`;
}


// NGワードリストを定義
const ngWordsList = [
  "株式会社", "有限会社", "合同会社", "合資会社", "合名会社",
  "医療法人", "医療法人社団", "医療法人財団", "社会医療法人",
  "宗教法人", "学校法人", "社会福祉法人", "更生保護法人", "相互会社",
  "特定非営利活動法人", "独立行政法人", "地方独立行政法人", "弁護士法人",
  "有限責任中間法人", "無限責任中間法人", "行政書士法人", "司法書士法人",
  "税理士法人", "国立大学法人", "公立大学法人", "農事組合法人", "管理組合法人",
  "社会保険労務士法人", "一般社団法人", "公益社団法人", "一般財団法人",
  "公益財団法人", "非営利法人", "(株)", "(有)", "支店"
];

// 正規表現パターンを生成（一度だけ計算して再利用するため）
const ngWordsPattern = new RegExp(
  ngWordsList.map(word => escapeRegExp(word)).join('|'),
  'g'
);

// 正規表現のメタ文字をエスケープする補助関数
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}








// OCR結果の後処理を行う関数（フィールドタイプ別）
function postProcessOcrResult(text, fieldType) {
  if (!text) return text;
  
  // Normalize text
  text = text.normalize('NFC').trim();
  
  // 全角英数字を半角に変換
  text = text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);  // 全角英数字を半角に変換
  });
  
  // 記号類を半角に変換（中点と全角ピリオド）
  text = text.replace(/[・．]/g, function(s) {
    if (s === '・') return '･';  // 全角中点を半角中点に変換
    if (s === '．') return '.';  // 全角ピリオドを半角ピリオドに変換
    return s;
  });

  // 半角カタカナを全角カタカナに変換（より詳細な変換）
  const halfToFullKatakanaMap = {
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
    'ｰ': 'ー', /* 中点エントリを削除 */ 'ﾞ': '゛', 'ﾟ': '゜'
  };
  
  // 濁点・半濁点の特別処理
  text = text.replace(/([ｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾊﾋﾌﾍﾎ])ﾞ/g, function(match, p1) {
    const base = halfToFullKatakanaMap[p1];
    const dakutenMap = {
      'カ': 'ガ', 'キ': 'ギ', 'ク': 'グ', 'ケ': 'ゲ', 'コ': 'ゴ',
      'サ': 'ザ', 'シ': 'ジ', 'ス': 'ズ', 'セ': 'ゼ', 'ソ': 'ゾ',
      'タ': 'ダ', 'チ': 'ヂ', 'ツ': 'ヅ', 'テ': 'デ', 'ト': 'ド',
      'ハ': 'バ', 'ヒ': 'ビ', 'フ': 'ブ', 'ヘ': 'ベ', 'ホ': 'ボ'
    };
    return dakutenMap[base] || (base + '゛');
  });
  
  text = text.replace(/([ﾊﾋﾌﾍﾎ])ﾟ/g, function(match, p1) {
    const base = halfToFullKatakanaMap[p1];
    const handakutenMap = {
      'ハ': 'パ', 'ヒ': 'ピ', 'フ': 'プ', 'ヘ': 'ペ', 'ホ': 'ポ'
    };
    return handakutenMap[base] || (base + '゜');
  });
  
  // 残りの半角カタカナを全角に変換
  text = text.replace(/[ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｰ]/g, function(s) {
    return halfToFullKatakanaMap[s] || s;
  });
  
  // 支払先名の場合、NGワードを除外
  if (fieldType === 'payee-name') {
    // NGワードを除外
    text = removeNgWords(text);
  }

  switch (fieldType) {
    case 'phone-number':
      // 複数の電話番号を含む場合、カンマで区切られたまま返す
      if (text.includes(',') || text.includes('、')) {
        // Split by comma, process each number, then rejoin
        const numbers = text.split(/[,、]/).map(num => {
          let cleaned = num.trim().replace(/[^\d\-+]/g, '');
          return formatPhoneNumber(cleaned);
        });
        
        // カンマで区切って返す（これがコンテンツスクリプトのfillTextFieldに渡される）
        return numbers.join(',');
      } else {
        // 単一の電話番号の場合
        text = text.replace(/[^\d\-+]/g, '');
        return formatPhoneNumber(text);
      }
    case 'payee-name':
      // Clean up extra spaces and symbols
      text = text.replace(/\s+/g, ' ').trim();
      break;
      
    case 'phonetic':
      // Convert katakana to hiragana
      text = text.replace(/[\u30A1-\u30FA]/g, function(match) {
        return String.fromCharCode(match.charCodeAt(0) - 0x60);
      });
      break;
      
    case 'clipboard':
      // No special processing for clipboard
      break;
  }
  
  return text;
}


/**
 * NGワードをテキストから除外する関数
 * @param {string} text - 処理するテキスト
 * @returns {string} - NGワードが除外されたテキスト
 */
function removeNgWords(text) {
  // ステップ1: 単純に正規表現で一括置換
  let processedText = text.replace(ngWordsPattern, '');
  
  // ステップ2: カンマ区切りのケースを処理
  if (processedText.includes(',') || processedText.includes('、')) {
    const items = processedText.split(/[,、]/).map(item => {
      // 各項目からNGワードを除去して空白も整理
      return item.trim().replace(/\s+/g, ' ');
    }).filter(item => item.length > 0); // 空の項目を削除
    
    processedText = items.join(',');
  }
  
  // 前後の空白を削除
  processedText = processedText.trim();
  
  // "会社名: " のようなラベルの後に何も残らない場合の処理
  processedText = processedText.replace(/会社名:\s*$/i, '');
  
  // コロン+空白が残っている場合は削除
  processedText = processedText.replace(/:\s*$/g, '');
  
  return processedText;
}


// Helper function to format phone numbers
function formatPhoneNumber(digits) {

  // 入力の検証を追加
  if (!digits) return '';
  
  // 桁数チェックを追加
  const digitsOnly = digits.replace(/[^\d]/g, '');
  if (digitsOnly.length > 11) {
    console.warn('電話番号の桁数が多すぎます:', digitsOnly.length, '桁');
    return '';  // 無効な電話番号は空文字を返す
  }

  // If already contains hyphens, first check if the format is valid
  if (digits.includes('-')) {
    // If it matches a valid format with hyphens, return as is
    if (/^\d{2,4}-\d{2,4}-\d{4}$/.test(digits)) {
      return digits;
    }
    // Otherwise remove hyphens for reformatting
    digits = digits.replace(/-/g, '');
  }
  
  // Ensure we only have digits at this point
  digits = digits.replace(/[^\d]/g, '');
  
  // Format based on length
  if (/^\d{10,11}$/.test(digits)) {
    if (digits.length === 10) {
      // 10-digit number processing
      if (digits.startsWith('03')) {
        // Tokyo numbers starting with 03
        return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
      } else if (digits.startsWith('06')) {
        // Osaka numbers starting with 06
        return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
      } else if (digits.startsWith('04')) {
        // other numbers starting with 04
        return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
      } else if (digits.startsWith('052') || digits.startsWith('072') || digits.startsWith('075') || 
                digits.startsWith('078') || digits.startsWith('082') || digits.startsWith('092')) {
        // 3-digit area codes (Nagoya, Osaka-area, Kyoto, Kobe, Hiroshima, Fukuoka)
        return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
      } else if (digits.startsWith('0120')) {
        // free dial
        return digits.replace(/^(\d{4})(\d{2})(\d{4})$/, '$1-$2-$3');
      } else if (digits.startsWith('0')) {
        // Other land-line numbers - try to guess area code length
        // If starts with 04, 05, 07, 08, 09 likely 3-digit area code
        if (/^0[4-9]/.test(digits)) {
          return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
        } else {
          // Default to 2-digit area code
          return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
        }
      } else {
        // If no area code pattern recognized, just format as 3-3-4
        return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
      }
    } else if (digits.length === 11) {
      // Mobile phones (11 digits) or IP phones
      if (digits.startsWith('0')) {
        return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
      } else {
        // Non-standard 11-digit format
        return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
      }
    }
  } else if (digits.length === 8) {
    // Local call only - no area code (8 digits)
    return digits.replace(/^(\d{4})(\d{4})$/, '$1-$2');
  } else if (digits.length === 9) {
    // Some unusual 9-digit numbers
    return digits.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1-$2-$3');
  }
  // If format doesn't match known patterns, return digits without changes
  return digits;
}


// コンテンツスクリプトが読み込まれていることを確認する関数
function ensureContentScriptLoaded(tabId) {
  return new Promise((resolve, reject) => {
    // まず、コンテンツスクリプトがすでに読み込まれているか確認
    chrome.tabs.sendMessage(tabId, { action: "ping" }, function(response) {
      if (chrome.runtime.lastError) {
        console.log("コンテンツスクリプトをロードする必要があります:", chrome.runtime.lastError.message);
        
        // コンテンツスクリプトを動的に挿入
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"]
        }).then(() => {
          console.log("コンテンツスクリプトが正常に挿入されました");
          
          // 挿入後にもう一度pingを送信して確認
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: "ping" }, function(response) {
              if (chrome.runtime.lastError) {
                console.error("コンテンツスクリプト挿入後も応答なし:", chrome.runtime.lastError.message);
                reject(new Error("コンテンツスクリプトの挿入に失敗しました"));
              } else {
                console.log("コンテンツスクリプトが応答しました");
                resolve(true);
              }
            });
          }, 500); // 少し待ってからpingを送信
          
        }).catch(err => {
          console.error("スクリプト挿入エラー:", err);
          reject(err);
        });
      } else {
        console.log("コンテンツスクリプトはすでに読み込まれています");
        resolve(true);
      }
    });
  });
}



function parseMultiFieldResult(text) {
  const result = {
    'payee-name': '',
    'phone-number': ''
  };
  
  console.log('OCR結果の解析開始:', text);
  
  // 正規表現で各フィールドの値を抽出
  const companyMatch = text.match(/会社名:[\s　]*(.*?)(?:\n|$)/i);
  const phoneMatch = text.match(/電話番号:[\s　]*(.*?)(?:\n|$)/i);
  
  // 抽出した値を取得
  let companyName = companyMatch && companyMatch[1] ? companyMatch[1].trim() : '';
  let phoneNumber = phoneMatch && phoneMatch[1] ? phoneMatch[1].trim() : '';
  
  // 重要: 抽出後に半角変換を適用
  companyName = postProcessOcrResult(companyName, 'payee-name');
  phoneNumber = postProcessOcrResult(phoneNumber, 'phone-number');
  
  // 会社名から電話番号に関する文字列を除外


  if (companyName.match(/^\s*電話番号:?\s*$/i)) {
    companyName = ''; // "電話番号:" のような文字列を空にする
  }
  if (phoneNumber.match(/^\s*会社名:?\s*$/i)) {
    phoneNumber = ''; // "会社名:" のような文字列を空にする
  }

  if (companyName) {
    // 複数候補がある場合
    if (companyName.includes(',') || companyName.includes('、')) {
      // カンマで分割して処理、ただし複数候補として保持
      const companyNames = companyName.split(/[,、]/)
        .map(name => name.trim())
        .filter(name => {
          return name && 
                 !name.match(/^\s*電話番号:?/i) && 
                 !name.match(/^tel:?/i) && 
                 !name.match(/^phone:?/i) &&
                 !name.match(/^\d[\d\-\s\(\)]*$/);
        });
      
      // 複数候補をカンマ区切りで保持
      if (companyNames.length > 0) {
        companyName = companyNames.join(',');
      } else {
        companyName = '';
      }
    }
  }
  
  // 電話番号からも会社名に関する文字列を除外（念のため）
  if (phoneNumber) {
    // 電話番号から「会社名:」を除外
    if (phoneNumber.match(/^\s*会社名:?/i)) {
      phoneNumber = '';
    }
  }
  
  console.log('抽出された会社名（フィルタリング後）:', companyName);
  console.log('抽出された電話番号（フィルタリング後）:', phoneNumber);
  
  // 値を設定
  result['payee-name'] = companyName;
  result['phone-number'] = phoneNumber;
  
  console.log('最終解析結果:', result);
  return result;
}




/**
 * キャッシュキーの生成
 */
async function generateCacheKey(imageData, options) {
  // 単純化のためimageDataの先頭部分とオプションからハッシュを生成
  const sampleData = imageData.substring(0, 100) + JSON.stringify(options);
  
  // SHA-256ハッシュの生成
  const encoder = new TextEncoder();
  const data = encoder.encode(sampleData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // バッファを16進文字列に変換
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
/**
 * キャッシュサイズの制限
 */
function limitCacheSize(maxEntries = 20) {
  if (imageCache.size <= maxEntries) return;
  
  // 最も古いエントリーから削除
  const keysIterator = imageCache.keys();
  for (let i = 0; i < imageCache.size - maxEntries; i++) {
    const key = keysIterator.next().value;
    imageCache.delete(key);
  }
}

// メモリキャッシュの実装
const imageProcessingCache = {
  cache: new Map(),
  async get(imageData, options) {
    const key = await generateCacheKey(imageData, options);
    return this.cache.get(key);
  },
  async set(imageData, result, options) {
    const key = await generateCacheKey(imageData, options);
    this.cache.set(key, result);
    
    // キャッシュサイズの制限（30件まで）
    if (this.cache.size > 30) {
      // 最も古いキーを削除
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }
};






/**
 * 画像処理の統合ハンドラ
 */
async function handleImageProcessing(request, tabId) {
  try {
    // 画像データの検証
    if (!request.imageData || !request.imageData.startsWith('data:image/')) {
      throw new Error("無効な画像データです");
    }
    
    // 設定を読み込み
    const settings = await loadSettings();
    
    // キャッシュの確認
    const cacheKey = await cacheKeySimple(request.imageData, request.field);
    const cachedResult = imageCache.get(cacheKey);
    
    if (cachedResult) {
      console.log("キャッシュから結果を取得");
      return {success: true, text: cachedResult};
    }
    
    // 処理中通知を送信
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: "showProcessing",
        message: "画像を最適化してOCR処理中..."
      });
    }
    
    // 新しい関数を使用して画像処理とOCR
    const ocrResult = await processImageForOCR(request.imageData, {
      language: settings.language || 'ja',
      mode: settings.mode || 'accurate',
      fieldType: request.field || null
    });
    
    // テキスト後処理
    const processedText = postProcessOcrResult(ocrResult.text, request.field);
    
    // 結果をキャッシュに保存
    imageCache.set(cacheKey, processedText);
    
    // 簡易的なキャッシュ制限
    if (imageCache.size > 30) {
      const oldestKey = imageCache.keys().next().value;
      imageCache.delete(oldestKey);
    }
    
    // 処理中通知を非表示
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: "hideProcessing"
      });
    }
    
    // 成功結果を返す
    return {success: true, text: processedText};
  } catch (error) {
    // エラー処理
    console.error("画像処理エラー:", error);
    
    // 処理中通知を非表示にし、エラーを表示
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: "hideProcessing"
      });
      
      chrome.tabs.sendMessage(tabId, {
        action: "showError",
        error: getReadableErrorMessage(error)
      });
    }
    
    throw error;
  }
}



  async function cacheKeySimple(imageData, fieldType) {
     const settings = await loadSettings();
     const sampleData = imageData.substring(0, 100) + 
                    (fieldType || '') + 
                    settings.language + 
                    settings.mode + 
                    settings.model;  // ← 設定を含める
  
  // SHA-256ハッシュの生成
  const encoder = new TextEncoder();
  const data = encoder.encode(sampleData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // バッファを16進文字列に変換
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}











/**
 * 統合された画像前処理関数 - 重複コードを削除し効率化
 * @param {string} imageData - Base64エンコードされた画像データ
 * @param {Object} options - 処理オプション
 * @returns {Promise<string>} - 最適化された画像データ
 */
async function optimizeImage(imageData, options = {}) {
  try {
    // 画像データの検証
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      return imageData; // 無効な場合は元の画像を返す
    }
    
    // Base64 → Blob → 画像オブジェクト
    const blob = await fetch(imageData).then(res => res.blob());
    const img = await createImageBitmap(blob);
    
    // 回転情報を取得
    const rotation = options.rotation || 0;
    const isQuarterRotated = options.isQuarterRotated || Math.abs(rotation % 180) === 90;
    
    // リサイズの必要性を判断
    const MAX_DIMENSION = options.maxDimension || 1600;
    let targetWidth = img.width;
    let targetHeight = img.height;
    
    // 90度回転している場合は幅と高さを入れ替えて考慮
    if (isQuarterRotated) {
      // 幅と高さを入れ替えて最大サイズをチェック
      if (targetHeight > MAX_DIMENSION || targetWidth > MAX_DIMENSION) {
        if (targetHeight > targetWidth) {
          targetWidth = Math.round(targetWidth * (MAX_DIMENSION / targetHeight));
          targetHeight = MAX_DIMENSION;
        } else {
          targetHeight = Math.round(targetHeight * (MAX_DIMENSION / targetWidth));
          targetWidth = MAX_DIMENSION;
        }
      }
    } else {
      // 通常の最大サイズチェック
      if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round(targetHeight * (MAX_DIMENSION / targetWidth));
          targetWidth = MAX_DIMENSION;
        } else {
          targetWidth = Math.round(targetWidth * (MAX_DIMENSION / targetHeight));
          targetHeight = MAX_DIMENSION;
        }
      }
    }
    
    // キャンバスを作成し、回転を考慮したサイズに設定
    const canvas = new OffscreenCanvas(
      isQuarterRotated ? targetHeight : targetWidth,
      isQuarterRotated ? targetWidth : targetHeight
    );
    const ctx = canvas.getContext('2d');
    
    // 回転が必要な場合
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      
      if (isQuarterRotated) {
        // 90度/270度回転の場合
        ctx.drawImage(
          img,
          -targetWidth / 2,  // 回転時は幅と高さが入れ替わる
          -targetHeight / 2, // 回転時は幅と高さが入れ替わる
          targetWidth,
          targetHeight
        );
      } else {
        // 0度/180度回転の場合
        ctx.drawImage(
          img,
          -targetWidth / 2,
          -targetHeight / 2,
          targetWidth,
          targetHeight
        );
      }
      ctx.restore();
    } else {
      // 回転なしの場合は通常描画
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    
// 必要な場合のみ画像処理を適用
if ((options.enhanceText || options.contrast) && canvas.width * canvas.height < 300000) {  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  if (options.contrast) {
    const factor = options.contrast || 1.15;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        data[i + j] = Math.max(0, Math.min(255, Math.round((data[i + j] - 128) * factor + 128)));
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}
    
    // 最適な品質を決定
    const quality = typeof options.quality === 'number' ? 
      options.quality : 
      (canvas.width * canvas.height > 800000 ? 0.88 : 0.95);
    
    // BlobからデータURLに変換
    const resultBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: quality
    });
    
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(resultBlob);
    });
  } catch (error) {
    console.error('画像最適化エラー:', error);
    return imageData; // エラー時は元の画像を返す
  }
}

/**
 * 画像コントラストの強調
 * @param {Uint8ClampedArray} data - 画像ピクセルデータ
 * @param {number} factor - コントラスト係数
 */
function enhanceContrast(data, factor = 1.2) {
  for (let i = 0; i < data.length; i += 4) {
    // RGB各チャンネルを処理
    for (let j = 0; j < 3; j++) {
      const val = data[i + j];
      // コントラスト調整式
      data[i + j] = clamp((val - 128) * factor + 128);
    }
  }
}
/**
 * テキスト認識向けの画像強調処理 - 単純化版
 * @param {Uint8ClampedArray} data - 画像ピクセルデータ
 */
function enhanceTextVisibility(data) {
  // エッジを強調
  const width = Math.sqrt(data.length / 4);
  const height = width;
  
  // 簡易シャープニング（エッジ強調）
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // 中央ピクセルの輝度を計算
      const centerLuma = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // 周辺ピクセルの平均輝度を計算
      const surroundingIdx = [
        ((y - 1) * width + x) * 4,
        ((y + 1) * width + x) * 4,
        (y * width + (x - 1)) * 4,
        (y * width + (x + 1)) * 4
      ];
      
      let surroundingLuma = 0;
      for (const sIdx of surroundingIdx) {
        surroundingLuma += (data[sIdx] + data[sIdx + 1] + data[sIdx + 2]) / 3;
      }
      surroundingLuma /= 4;
      
      // エッジ検出（輝度差）
      const diff = centerLuma - surroundingLuma;
      const enhancement = 0.5; // エッジ強調度合い
      
      // エッジを強調
      for (let c = 0; c < 3; c++) {
        data[idx + c] = clamp(data[idx + c] + diff * enhancement);
      }
    }
  }
}

/**
 * 値を0-255の範囲に収める
 * @param {number} value - 入力値
 * @returns {number} - 0-255に収められた値
 */
function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}


/**
 * データサイズに基づいて最適な画質を決定
 * @param {boolean} isLargeImage - 大きな画像かどうか
 * @param {number} baseQuality - 基本品質設定
 * @returns {number} - 最適な品質設定（0.0-1.0）
 */
function determineOptimalQuality(isLargeImage, baseQuality) {
  // ベース品質がある場合はそれを使用
  if (typeof baseQuality === 'number') {
    return baseQuality;
  }
  
  // 大きな画像は低い品質、小さな画像は高い品質
  return isLargeImage ? 0.85 : 0.92;
}

/**
 * データURLのサイズを推定（MB単位）
 * @param {string} dataUrl - 画像のデータURL
 * @returns {number} - 推定サイズ（MB）
 */
function getDataSize(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.split(',')[1] || '';
  // Base64から元のバイト数を推定（Base64は4:3の比率）
  return (base64.length * 0.75) / (1024 * 1024);
}

/**
 * データURLから画像オブジェクトを作成
 * @param {string} dataUrl - 画像のデータURL
 * @returns {Promise<ImageBitmap>} - 画像オブジェクト
 */
async function createImageFromDataURL(dataUrl) {
  // Base64からBlobに変換
  const byteString = atob(dataUrl.split(',')[1]);
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  const blob = new Blob([ab], { type: mimeString });
  
  // Blobから画像を作成
  return await createImageBitmap(blob);
}


/**
 * BlobをデータURLに変換
 * @param {Blob} blob - Blobオブジェクト
 * @returns {Promise<string>} - データURL
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


/**
 * 画像を処理してOCRを実行
 * @param {string} imageData - 画像データ
 * @param {Object} options - 処理オプション
 * @returns {Promise<Object>} - OCR結果
 */
async function processImageForOCR(imageData, options = {}) {
  try {
    // 設定に基づいて画像を最適化
    const optimizedImage = await optimizeImage(imageData, {
      maxDimension: options.maxDimension || 1600,
      enhanceText: options.mode === 'accurate',
      contrast: options.mode === 'accurate' ? 1.3 : 1.1,
      quality: options.quality,
      rotation: options.rotation, // 回転情報を渡す
      isQuarterRotated: options.isQuarterRotated // 90度回転フラグを渡す
    });
    
    // OCR処理
    const ocrResult = await extractTextWithGemini(optimizedImage, {
      language: options.language || 'ja',
      mode: options.mode || 'accurate',
      fieldType: options.fieldType
    });
        // 空の結果をチェック
    if (!ocrResult.text || ocrResult.text.trim() === '') {
      // 特定のフィールドタイプに合わせたエラーメッセージ
      let errorMessage = "";
      if (options.fieldType === 'phone-number') {
        errorMessage = "電話番号を認識できませんでした";
      } else if (options.fieldType === 'payee-name') {
        errorMessage = "支払先名を認識できませんでした";
      } else {
        errorMessage = "テキストを認識できませんでした";
      }
      
      // 空結果エラーを投げる
      const emptyResultError = new Error(errorMessage);
      emptyResultError.code = 'EMPTY_RESULT';
      throw emptyResultError;
    }
    return ocrResult;
  } catch (error) {
    console.error('OCR処理エラー:', error);
    throw error;
  }
}













// 画像処理キャッシュ
const imageCache = new Map();

// メッセージリスナー
// ハンドラーマップ（各アクションを関数に分離）
const messageHandlers = {
  async processImage(request, sender) {
    return await handleImageProcessing(request, sender.tab?.id);
  },

  async processFullImage(request, sender) {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length === 0) {
      throw new Error("アクティブなタブが見つかりません");
    }
    
    chrome.tabs.sendMessage(tabs[0].id, {action: "processFullImage"});
    return {success: true};
  },

  cancelProcessing(request, sender) {
    isProcessingCancelled = true;
    return {cancelled: true};
  },

  checkProcessingStatus(request, sender) {
    return {cancelled: isProcessingCancelled};
  },

  async ensureContentScriptLoaded(request, sender) {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length === 0) {
      throw new Error("アクティブなタブが見つかりません");
    }
    
    await ensureContentScriptLoaded(tabs[0].id);
    return {success: true};
  },

  streamedDockOcr(request, sender) {
    // 既存のstreamedDockOcrHandler関数をそのまま呼び出し
    return new Promise((resolve, reject) => {
      streamedDockOcrHandler(request, sender, (response) => {
        if (response.success === false) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  },

  async testApiKey(request, sender) {
    if (!request.apiKey) {
      throw new Error("APIキーが指定されていません");
    }
    
    // 既存のAPIテストロジックをそのまま使用
    const testPrompt = "テスト";
    const testImageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA2ElEQVQ4jbWTMQ6CQBBFn8bEeAKvIJ2JdYnxFiaeQisrOYRH0BtYWNBARWKCJhZj3BV38YdiZvLy/2Zmdg3/SkTagHU+lFmL9N5c5fYM1Cc22AG1iPSAdV2zbUhEemCj43bAQNc2JGwKbDCISBfYAk1DNM+2QKf9wgFq4JBEbxGRATg6jN2j3krBFrgAk8Nwcgwye/pQgUmfwyHQA1fHG6wCg+uNWFFnNmRJyuJ7NQrJ5W0UBauKiw6Fb2ASEv5SsOApbI+CW/IIbOOvjjZF5AHM/+2Nbx+PqQ3GH5qPAAAAAElFTkSuQmCC";
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${request.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: testPrompt },
            { inline_data: { mime_type: "image/png", data: testImageData.split(',')[1] } }
          ]
        }]
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`API エラー: ${err.error?.message || JSON.stringify(err)}`);
    }
    
    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      return {success: true, message: "APIキーは正常に動作しています"};
    } else {
      throw new Error("APIレスポンスが無効です");
    }
  },

  getVersionInfo(request, sender) {
    const manifest = chrome.runtime.getManifest();
    return {
      version: manifest.version,
      name: manifest.name,
      success: true
    };
  },

  async getDebugInfo(request, sender) {
    const settings = await chrome.storage.local.get(null);
    
    if (settings.geminiApiKey) {
      settings.geminiApiKey = settings.geminiApiKey.substring(0, 5) + "..." + 
                             settings.geminiApiKey.substring(settings.geminiApiKey.length - 4);
    }
    
    return {
      success: true,
      debugInfo: {
        settings: settings,
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        extensionInfo: {
          version: chrome.runtime.getManifest().version,
          id: chrome.runtime.id
        },
        cacheInfo: {
          size: imageCache ? imageCache.size : 0
        }
      }
    };
  },

  clearCache(request, sender) {
    if (imageCache) {
      imageCache.clear();
      console.log("画像処理キャッシュをクリアしました");
    }
    return {success: true, message: "キャッシュをクリアしました"};
  },

  async executeFullOcrFromPopup(request, sender) {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length === 0) {
      throw new Error("アクティブなタブが見つかりません");
    }
    
    await ensureContentScriptLoaded(tabs[0].id);
    chrome.tabs.sendMessage(tabs[0].id, {action: "processFullImage"});
    return {success: true};
  },

  async executeAreaOcrFromPopup(request, sender) {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length === 0) {
      throw new Error("アクティブなタブが見つかりません");
    }
    
    await ensureContentScriptLoaded(tabs[0].id);
    chrome.tabs.sendMessage(tabs[0].id, {action: "startSelection"});
    return {success: true};
  },

    async checkApiKey(request, sender) {
    const hasKey = await secureKeyManager.keyExists();
    const isValid = hasKey ? await secureKeyManager.validateKey() : false;
    return {
      hasKey: hasKey,
      isValid: isValid
    };
  },
  
  async getDebugInfo(request, sender) {
    const settings = await chrome.storage.local.get(null);
    
    // ===== 修正: APIキーを完全に除外 =====
    if (settings.geminiApiKey) {
      settings.geminiApiKey = "[設定済み - セキュリティのため非表示]";
    }
    // =====================================
    
    return {
      success: true,
      debugInfo: {
        settings: settings,
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        extensionInfo: {
          version: chrome.runtime.getManifest().version,
          id: chrome.runtime.id
        },
        cacheInfo: {
          size: imageCache ? imageCache.size : 0
        }
      }
    };
  }
};

// 統一されたメッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const handler = messageHandlers[request.action];
      if (!handler) {
        throw new Error(`不明なアクション: ${request.action}`);
      }
      
      const result = await handler(request, sender);
      sendResponse(result);
    } catch (error) {
      console.error(`アクション ${request.action} でエラー:`, error);
      sendResponse({
        success: false, 
        error: getReadableErrorMessage ? getReadableErrorMessage(error) : error.message
      });
    }
  })();
  return true;
});

/**
 * STREAMED Dock サイト専用のOCR処理ハンドラ
 * @param {Object} request - リクエスト情報
 * @param {Object} sender - 送信者情報
 * @param {Function} sendResponse - レスポンス送信関数
 * @returns {boolean} - 非同期処理を示すブール値
 */
function streamedDockOcrHandler(request, sender, sendResponse) {
  console.log('STREAMED Dock 専用 OCR リクエスト:', request.field || '不明なフィールド');
  
  const tabId = sender.tab?.id;
  if (!tabId) {
    console.error('有効なタブIDが取得できません');
    sendResponse({success: false, error: "タブが無効です"});
    return true;
  }

if (isTabProcessing(tabId)) {
  console.log('タブ', tabId, 'は既に処理中です - 強制解除して続行');
  setTabProcessing(tabId, false); // 強制的にリセット
  }

  // 処理開始をマーク
  setTabProcessing(tabId, true);
  // ===============================
  currentProcessingTabId = tabId;
  
  // 既存のエラー通知をクリア（安全な送信）
  safeTabMessage(tabId, {action: "clearErrorNotifications"});

  // 画像データのバリデーション
  if (!request.imageData || typeof request.imageData !== 'string' || !request.imageData.startsWith('data:image/')) {
    console.error("無効な画像データです");
    safeTabMessage(tabId, {
      action: "showError",
      error: "無効な画像データです。再度お試しください。"
    });
    
   setTabProcessing(tabId, false);

    sendResponse({success: false, error: "無効な画像データです"});
    return true;
  }
  

  // 処理全体を Promise でラップして制御
  const processingPromise = new Promise((resolve, reject) => {
    chrome.storage.local.get(['ocrLanguage', 'ocrMode', 'geminiApiKey', 'geminiModel'], function(result) {
      const language = result.ocrLanguage || 'ja';
      const mode = result.ocrMode || 'accurate';
      const model = result.geminiModel || 'gemini-2.0-flash';
      
      if (!result.geminiApiKey) {
        const error = new Error("APIキーが設定されていません");
        reject(error);
        return;
      }
        // 待機メッセージを送信（安全な送信）
  safeTabMessage(tabId, {
    action: "showProcessing",
    message: "Gemini APIでテキスト認識中..."
  });
  
      processImageForOCR(request.imageData, {
        language: language,
        mode: mode,
        fieldType: request.field,
        model: model,
        region: request.region,
        rotation: request.rotation,
        isQuarterRotated: request.isQuarterRotated
      })
      .then(result => {
        // 処理中通知を非表示（安全な送信）
        return safeTabMessage(tabId, { action: "hideProcessing" })
          .then(() => result);
      })
      .then(result => {
        // OCR結果の処理分岐
        if (request.field === 'payee-name') {
          const multiFieldResult = parseMultiFieldResult(result.text);
          console.log('複数フィールド解析結果:', multiFieldResult);
          
          return safeTabMessage(tabId, {
            action: "checkFieldValues",
            fields: ['payee-name', 'phone-number']
          }).then(fieldValues => {
            return {
              result: { 
                'payee-name': multiFieldResult['payee-name'],
                'phone-number': multiFieldResult['phone-number']
              },
              fieldValues: fieldValues || {},
              mode: 'multi-field'
            };
          });
        } else {
          const processedText = postProcessOcrResult(result.text, request.field);
          
          return safeTabMessage(tabId, {
            action: "checkFieldValues",
            fields: [request.field]
          }).then(fieldValues => {
            return {
              result: { [request.field]: processedText },
              fieldValues: fieldValues || {},
              mode: 'single-field'
            };
          });
        }
      })
      .then(data => {
        // フィールド入力処理
        const actions = [];
        let successMessage = "";
        
        // 電話番号の処理関数（安全な送信版）
        const processPhoneNumber = (phoneText, currentValue) => {
          if (!phoneText) return { actions: [], message: "" };
          
          console.log('電話番号処理:', phoneText);
          
          let phoneNumbers = [];
          const hasMultipleCandidates = phoneText.includes(',') || phoneText.includes('、') || phoneText.includes(';');
          
          if (hasMultipleCandidates) {
            phoneNumbers = phoneText.split(/[,、;]/)
              .map(num => num.trim())
              .filter(num => num && /\d/.test(num));
            console.log('複数の電話番号候補を検出:', phoneNumbers);
          } else {
            phoneNumbers = [phoneText];
            console.log('単一の電話番号:', phoneNumbers);
          }
          
          const result = {
            actions: [],
            message: ""
          };
          
          if (phoneNumbers.length > 0) {
            result.actions.push(safeTabMessage(tabId, {
              action: "streamedDockPhoneDropdown",
              phoneNumbers: phoneNumbers,
              originalText: phoneText
            }));
            
            const phonesText = phoneNumbers.length > 1 ? 
              `複数の電話番号（${phoneNumbers.length}件）` : 
              `電話番号「${phoneNumbers[0]}」`;
            
            result.message = `${phonesText}を認識しました。ドロップダウンから選択してください`;
          }
          
          return result;
        };

        // 支払先名の処理関数（安全な送信版）
        const processPayeeName = (payeeNameText) => {
          if (!payeeNameText) return { actions: [], message: "" };
          
          console.log('支払先名処理:', payeeNameText);
          
          const hasMultipleCandidates = payeeNameText.includes(',') || payeeNameText.includes('、');
          
          if (hasMultipleCandidates) {
            const payeeNames = payeeNameText.split(/[,、]/)
              .map(name => name.trim())
              .filter(name => name.length > 0);
            
            console.log('複数の支払先名候補を検出:', payeeNames);
            
            const uniquePayeeNames = [...new Set(payeeNames)];
            
            if (uniquePayeeNames.length > 1) {
              return {
                actions: [safeTabMessage(tabId, {
                  action: "showPayeeNameDropdown",
                  payeeNames: uniquePayeeNames
                })],
                message: `複数の支払先名候補（${uniquePayeeNames.length}件）を認識しました。選択してください`
              };
            } else if (uniquePayeeNames.length === 1) {
              return {
                actions: [safeTabMessage(tabId, {
                  action: "fillTextField",
                  text: uniquePayeeNames[0],
                  field: 'payee-name'
                })],
                message: `「${uniquePayeeNames[0]}」を認識しました`
              };
            }
          } else {
            return {
              actions: [safeTabMessage(tabId, {
                action: "fillTextField",
                text: payeeNameText,
                field: 'payee-name'
              })],
              message: `「${payeeNameText}」を認識しました`
            };
          }
          
          return { actions: [], message: "" };
        };

        // モード別の処理
        if (data.mode === 'single-field') {
          const field = Object.keys(data.result)[0];
          const text = data.result[field];
          
          if (!text || text.trim() === '') {
            let noResultMessage = "";
            if (field === 'phone-number') {
              noResultMessage = "電話番号が認識できませんでした。別の領域を選択するか、画質を確認してください。";
            } else if (field === 'payee-name') {
              noResultMessage = "支払先名が認識できませんでした。別の領域を選択するか、画質を確認してください。";
            } else if (field === 'phonetic') {
              noResultMessage = "ふりがなが認識できませんでした。別の領域を選択するか、画質を確認してください。";
            } else {
              noResultMessage = "テキストが認識できませんでした。別の領域を選択するか、画質を確認してください。";
            }
            
            actions.push(safeTabMessage(tabId, {
              action: "showError",
              error: noResultMessage
            }));

            actions.push(safeTabMessage(tabId, {
              action: "updatePreviewStatus",
              status: "認識結果なし",
              type: "error"
            }));

            successMessage = "";
          } else {
            if (field === 'phone-number') {
              const currentValue = data.fieldValues[field] || '';
              const phoneResult = processPhoneNumber(text, currentValue);
              
              actions.push(...phoneResult.actions);
              successMessage = phoneResult.message || "電話番号を認識できませんでした";
            } else if (field === 'payee-name') {
              const payeeResult = processPayeeName(text);
              
              actions.push(...payeeResult.actions);
              successMessage = payeeResult.message || "支払先名を認識できませんでした";
            } else {
              actions.push(safeTabMessage(tabId, {
                action: "fillTextField",
                text: text,
                field: field
              }));
              successMessage = `「${text}」を認識しました`;
            }
          }
        } else {
          // 複数フィールド処理の場合
          const originalField = 'payee-name';
          
          if ((!data.result['payee-name'] || data.result['payee-name'].trim() === '') && 
              (!data.result['phone-number'] || data.result['phone-number'].trim() === '')) {
              
            const noResultMessage = "支払先名も電話番号も認識できませんでした。別の領域を選択するか、画質を確認してください。";
            
            actions.push(safeTabMessage(tabId, {
              action: "showError", 
              error: noResultMessage
            }));
            
            actions.push(safeTabMessage(tabId, {
              action: "updatePreviewStatus",
              status: "認識結果なし",
              type: "error"
            }));
            
            successMessage = "";
          } else {
            if (data.result['payee-name']) {
                const payeeResult = processPayeeName(data.result['payee-name']);
                actions.push(...payeeResult.actions);
                successMessage = payeeResult.message;
            }
            
            if (data.result['phone-number']) {
              const currentValue = data.fieldValues['phone-number'] || '';
              const phoneResult = processPhoneNumber(data.result['phone-number'], currentValue);
              
              actions.push(...phoneResult.actions);
              
              if (phoneResult.message) {
                successMessage += successMessage ? 
                  `、${phoneResult.message}` : 
                  phoneResult.message;
              }
            }

            actions.push(safeTabMessage(tabId, {
              action: "restoreFocus",
              field: originalField
            }));
          }
        }
        
        // すべてのアクションが完了したら通知を表示
        return Promise.all(actions).then(() => {
          if (successMessage) {
            return safeTabMessage(tabId, {
              action: "showNotification",
              message: successMessage,
              type: "success"
            }).then(() => {
              return safeTabMessage(tabId, {
                action: "updatePreviewStatus",
                status: successMessage,
                type: "success"
              });
            });
          }
          return Promise.resolve();
        });
      })
      .then(() => {
        resolve({ success: true });
      })
      .catch(error => {
        console.error("処理エラー:", error);
        
        // エラー処理（安全な送信）
        safeTabMessage(tabId, { action: "hideProcessing" })
          .then(() => {
            return safeTabMessage(tabId, {
              action: "showError",
              error: getReadableErrorMessage(error)
            });
          })
          .finally(() => {
            reject(error);
          });
      });
    });
  });
  
  // 処理完了時に sendResponse を呼び出す
  processingPromise
    .then(result => {
      sendResponse(result);
    })
    .catch(error => {
      sendResponse({
        success: false, 
        error: getReadableErrorMessage(error)
      });
    })
      .finally(() => {
      // ===== 処理完了を必ずマーク =====
      setTabProcessing(tabId, false);
      console.log('タブ', tabId, 'の処理が完了しました');
      // ==============================
    });
  return true;
}
// chrome.tabs.onUpdated リスナー

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  if (isTabProcessing(tabId)) {
    console.log('閉じられたタブ', tabId, 'の処理状態をクリア');
    setTabProcessing(tabId, false);
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // URLが設定されており、かつロード完了時
  if (changeInfo.status === 'complete' && tab.url) {
    // 特定のURLとの完全一致を確認
    const targetUrl = "https://dock.streamedup.com/receipt2/step/registvendor?step=regist";
    if (tab.url === targetUrl || tab.url.startsWith(targetUrl + "#")) {
      console.log('対象のURLを検出:', tab.url);
      
      // STREAMED Dock 連携スクリプトを注入
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["streamed-dock-integration.js"]
      }).then(() => {
        console.log('STREAMED Dock 連携スクリプトを注入しました');
      }).catch(err => {
        console.error('STREAMED Dock 連携スクリプト注入エラー:', err);
      });
    } else {
      console.log('対象外のURLのため、OCR機能は有効化しません:', tab.url);
    }
  }
});