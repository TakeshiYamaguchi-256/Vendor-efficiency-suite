// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // DOM要素の参照を取得
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const toggleVisibilityButton = document.getElementById('toggleVisibility');
  const languageSelect = document.getElementById('language');
  const errorContainer = document.getElementById('errorContainer');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const modelSelect = document.getElementById('model');
  
  // OCRモード切り替え関連
  const toggleSwitch = document.getElementById('toggleSwitch');
  const modeIndicator = document.getElementById('modeIndicator');
  const modeDescription = document.getElementById('modeDescription');

  // APIキーの表示/非表示を切り替える
  toggleVisibilityButton.addEventListener('click', function() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibilityButton.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleVisibilityButton.textContent = '👁️';
    }
  });
  
  // OCRモード切り替えのイベントリスナー
  toggleSwitch.addEventListener('click', function() {
    const isAutomatic = toggleSwitch.classList.contains('active');
    
    if (isAutomatic) {
      // オートマチック → マニュアル
      toggleSwitch.classList.remove('active');
      modeIndicator.textContent = 'マニュアル';
      modeIndicator.className = 'mode-indicator mode-manual';
      modeDescription.textContent = 'マニュアルモード: ボタンクリックまたはキーボードショートカットでOCRを実行します';
      
      // 設定を保存
      chrome.storage.local.set({ 'ocrAutoMode': false });
    } else {
      // マニュアル → オートマチック
      toggleSwitch.classList.add('active');
      modeIndicator.textContent = 'オートマチック';
      modeIndicator.className = 'mode-indicator mode-automatic';
      modeDescription.textContent = 'オートマチックモード: 画像読み込み完了時にテーブルに候補がない場合、自動でOCRを実行します';
      
      // 設定を保存
      chrome.storage.local.set({ 'ocrAutoMode': true });
    }
  });
  
  // APIキー保存ボタンのイベントリスナー
  saveApiKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showError("APIキーを入力してください");
      return;
    }
    
    // APIキーの形式を簡易チェック (AIzaで始まる文字列)
    if (!apiKey.startsWith('AIza')) {
      showError("有効なGemini APIキーを入力してください");
      return;
    }
    
    // ストレージに保存
    chrome.storage.local.set({ 'geminiApiKey': apiKey }, function() {
      // 保存成功を通知
      const originalText = saveApiKeyButton.textContent;
      
      saveApiKeyButton.textContent = '保存しました！';
      saveApiKeyButton.style.backgroundColor = '#4CAF50';
      
      // 2秒後に元に戻す
      setTimeout(() => {
        saveApiKeyButton.textContent = originalText;
        saveApiKeyButton.style.backgroundColor = '#1a73e8';
      }, 2000);
      
      // ステータスを更新
      updateAPIStatus(true);
    });
  });
  
  // コンテンツスクリプトが利用可能かチェックする関数
  function checkContentScriptAvailability(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        showError("アクティブなタブが見つかりません");
        updateStatus(false);
        callback(false);
        return;
      }
      
      // 安全なメッセージ送信を試みる
      try {
        chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
          // lastErrorがある場合はコンテンツスクリプトが利用できない
          if (chrome.runtime.lastError) {
            console.log("コンテンツスクリプト利用不可:", chrome.runtime.lastError.message);
            showError("このページではOCR機能が使えません。ページを再読み込みするか、別のページで試してください。");
            updateStatus(false);
            callback(false);
          } else {
            // 応答があった場合は利用可能
            console.log("コンテンツスクリプト利用可能");
            hideError();
            updateStatus(true);
            callback(true);
          }
        });
      } catch (e) {
        console.error("メッセージ送信中に例外が発生:", e);
        showError("通信エラーが発生しました");
        updateStatus(false);
        callback(false);
      }
    });
  }
  
  // APIステータスを確認・更新する関数
  function updateAPIStatus(force = false) {
  chrome.runtime.sendMessage({action: "checkApiKey"}, function(result) {
    if (result && result.hasKey) {
      apiKeyInput.placeholder = "APIキーは設定済みです（セキュリティのため非表示）";
      apiKeyInput.value = ""; // 値は一切表示しない
      apiKeyInput.style.backgroundColor = "#f0f8ff"; // 設定済みを示す背景色
    } else {
      apiKeyInput.placeholder = "API キーを入力してください";
      apiKeyInput.value = "";
      apiKeyInput.style.backgroundColor = ""; // デフォルト背景色
    }
  });
  }
  
  // ステータスを更新する関数
  function updateStatus(isAvailable) {
    if (isAvailable) {
      statusDot.className = "indicator-dot indicator-active";
      statusText.textContent = "OCR機能は利用可能です";
    } else {
      statusDot.className = "indicator-dot indicator-inactive";
      statusText.textContent = "OCR機能は利用できません";
    }
  }
  
  // エラーメッセージを表示する関数
  function showError(message) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
  
  // エラーメッセージを非表示にする関数
  function hideError() {
    errorContainer.style.display = 'none';
    updateAPIStatus();
  }
  
  // ラジオボタンのイベントリスナー
  const modeRadios = document.querySelectorAll('input[name="ocrMode"]');
  for (const radio of modeRadios) {
    radio.addEventListener('change', function() {
      chrome.storage.local.set({ 'ocrMode': this.value });
      
      console.log("OCRモード変更:", this.value);
      const helpText = document.querySelector('.help-text');
      if (helpText) {
        if (this.value === 'fast') {
          helpText.textContent = '速度優先モードでは、シンプルな文字認識のみを行います。';
        } else {
          helpText.textContent = '認識に問題がある場合は「精度優先」モードをお試しください。';
        }
      }
    });
  }
  
  // 言語設定のイベントリスナー
  languageSelect.addEventListener('change', function() {
    chrome.storage.local.set({ 'ocrLanguage': this.value });
    console.log("OCR言語変更:", this.value);
  });
  
  // モデル選択のイベントリスナー
  modelSelect.addEventListener('change', function() {
    chrome.storage.local.set({ 'geminiModel': this.value });
    console.log("AIモデル変更:", this.value);
    
    // ヘルプテキストの更新
    const helpText = document.querySelector('.model-section .help-text');
  if (helpText) {
    if (this.value === 'gemini-2.5-flash') {
      helpText.textContent = 'Gemini 2.5 Flashは最新モデルで、より高度な文字認識能力を持ちます。';
    } else if (this.value === 'gemini-2.0-flash-lite') {
      helpText.textContent = 'Gemini 2.0 Flash Liteは高速で低コストな軽量版モデルです。基本的な文字認識に適しています。';
    } else if (this.value === 'gemini-1.5-flash') {
      helpText.textContent = 'Gemini 1.5 Flashは一部のケースでより高い認識精度を持ちます。';
    } else {
      helpText.textContent = '文字認識の精度と速度のバランスを調整できます。問題がある場合は別のモデルをお試しください。';
    }
  }
  });

  // 保存された設定を読み込む
  chrome.storage.local.get(['geminiModel', 'ocrMode', 'ocrLanguage', 'ocrAutoMode'], function(result) {
    // モデル設定
    if (result.geminiModel) {
      modelSelect.value = result.geminiModel;
      
      // ヘルプテキストの更新
      const helpText = document.querySelector('.model-section .help-text');
    if (helpText) {
      if (result.geminiModel === 'gemini-2.5-flash') {
        helpText.textContent = 'Gemini 2.5 Flashは最新モデルで、より高度な文字認識能力を持ちます。';
      } else if (result.geminiModel === 'gemini-2.0-flash-lite') {
        helpText.textContent = 'Gemini 2.0 Flash Liteは高速で低コストな軽量版モデルです。基本的な文字認識に適しています。';
      } else if (result.geminiModel === 'gemini-1.5-flash') {
        helpText.textContent = 'Gemini 1.5 Flashは一部のケースでより高い認識精度を持ちます。';
      }
    }
    }
    
    // OCRモード設定
    if (result.ocrMode) {
      const radio = document.querySelector(`input[name="ocrMode"][value="${result.ocrMode}"]`);
      if (radio) {
        radio.checked = true;
        
        // ヘルプテキストも更新
        const helpText = document.querySelector('.help-text');
        if (helpText && result.ocrMode === 'fast') {
          helpText.textContent = '速度優先モードでは、シンプルな文字認識のみを行います。';
        }
      }
    }
    
    // 言語設定
    if (result.ocrLanguage) {
      languageSelect.value = result.ocrLanguage;
    }
    
    // オートモード設定
    const isAutoMode = result.ocrAutoMode === true;
    if (isAutoMode) {
      toggleSwitch.classList.add('active');
      modeIndicator.textContent = 'オートマチック';
      modeIndicator.className = 'mode-indicator mode-automatic';
      modeDescription.textContent = 'オートマチックモード: 画像読み込み完了時にテーブルに候補がない場合、自動でOCRを実行します';
    } else {
      toggleSwitch.classList.remove('active');
      modeIndicator.textContent = 'マニュアル';
      modeIndicator.className = 'mode-indicator mode-manual';
      modeDescription.textContent = 'マニュアルモード: ボタンクリックまたはキーボードショートカットでOCRを実行します';
    }
  });
  
  // ページロード時にコンテンツスクリプトの状態とAPIキーの状態を確認
  checkContentScriptAvailability(function(isAvailable) {
    console.log("初期コンテンツスクリプト状態:", isAvailable ? "利用可能" : "利用不可");
    updateAPIStatus();
  });
});