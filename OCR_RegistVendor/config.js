// config.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM要素
    const apiKeyInput = document.getElementById('apiKey');
    const toggleVisibilityButton = document.getElementById('toggleVisibility');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const apiSuccessMessage = document.getElementById('apiSuccessMessage');
    const apiErrorMessage = document.getElementById('apiErrorMessage');
    
    const languageSelect = document.getElementById('language');
    const modeRadios = document.querySelectorAll('input[name="ocrMode"]');
    const saveSettingsButton = document.getElementById('saveSettings');
    const settingsSuccessMessage = document.getElementById('settingsSuccessMessage');
    
    const resetSettingsButton = document.getElementById('resetSettings');
    const resetSuccessMessage = document.getElementById('resetSuccessMessage');

    const modelSelect = document.getElementById('model');
    
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
    
    // 保存されている設定を読み込む
    loadSettings();
    
    // APIキー保存ボタンのイベントリスナー
    saveApiKeyButton.addEventListener('click', function() {
      saveApiKey();
    });
    
    // 設定保存ボタンのイベントリスナー
    saveSettingsButton.addEventListener('click', function() {
      saveSettings();
    });
    
    // モデル選択のイベントリスナー（saveSettings ボタンのイベントリスナーの後に追加）
    modelSelect.addEventListener('change', function() {
      // モデル変更時に設定を自動保存
      saveSettings();
    });

    // 設定リセットボタンのイベントリスナー
    resetSettingsButton.addEventListener('click', function() {
      resetSettings();
    });
    
    // APIキーを保存する
    function saveApiKey() {
      const apiKey = apiKeyInput.value.trim();
      
      // APIキーのバリデーション (AIza で始まる文字列)
      if (!apiKey || !apiKey.startsWith('AIza')) {
        showMessage(apiErrorMessage, 3000);
        return;
      }
      
      // APIキーを保存
      chrome.storage.local.set({ 'geminiApiKey': apiKey }, function() {
        // 成功メッセージを表示
        showMessage(apiSuccessMessage, 3000);
      });
    }
    
    // OCR設定を保存する
function saveSettings() {
  const language = languageSelect.value;
  
  // 選択されたモードを取得
  let mode = 'accurate';
  for (const radio of modeRadios) {
    if (radio.checked) {
      mode = radio.value;
      break;
    }
  }
  
  // モデルの値を取得
  const model = modelSelect.value;
  
  // 設定を保存
  chrome.storage.local.set({
    'ocrLanguage': language,
    'ocrMode': mode,
    'geminiModel': model
  }, function() {
    // 成功メッセージを表示
    showMessage(settingsSuccessMessage, 3000);
  });
}
    
    // すべての設定をリセットする
    function resetSettings() {
      if (confirm('すべての設定をリセットしますか？この操作は元に戻せません。')) {
        chrome.storage.local.clear(function() {
          // 入力フィールドをクリア
          apiKeyInput.value = '';
          languageSelect.value = 'ja';
          document.getElementById('accurateMode').checked = true;
          
          // 成功メッセージを表示
          showMessage(resetSuccessMessage, 3000);
        });
      }
    }
    
    // 保存されている設定を読み込む
function loadSettings() {
  // ===== 修正: APIキーの存在確認のみ =====
  chrome.runtime.sendMessage({action: "checkApiKey"}, function(result) {
    if (result && result.hasKey) {
      apiKeyInput.placeholder = "APIキーは設定済みです（セキュリティのため非表示）";
      apiKeyInput.value = ""; // 値は一切表示しない
      apiKeyInput.style.backgroundColor = "#f0f8ff"; // 設定済みを示す背景色
    } else {
      apiKeyInput.placeholder = "Gemini API キーを入力してください";
      apiKeyInput.value = "";
      apiKeyInput.style.backgroundColor = ""; // デフォルト背景色
    }
  });
  // ========================================
  
  // OCR言語設定（変更なし）
  chrome.storage.local.get(['ocrLanguage', 'ocrMode', 'geminiModel'], function(result) {
    if (result.ocrLanguage) {
      languageSelect.value = result.ocrLanguage;
    }
    
    if (result.ocrMode) {
      const radio = document.querySelector(`input[name="ocrMode"][value="${result.ocrMode}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
    
    if (result.geminiModel) {
      modelSelect.value = result.geminiModel;
    }
  });
}
    
    // メッセージを表示して自動的に非表示にする
    function showMessage(element, duration) {
      if (!element) return;
      
      // メッセージを表示
      element.style.display = 'block';
      
      // 指定時間後に非表示にする
      setTimeout(function() {
        element.style.display = 'none';
      }, duration);
    }
  });