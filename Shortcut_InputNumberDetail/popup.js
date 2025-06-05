// デバッグ用のロギング機能を追加
function logDebug(message, data = null) {
  const log = `[Effect Selection] ${message}`;
  console.log(log, data || '');
}

document.addEventListener('DOMContentLoaded', function() {
  logDebug('Popup initialized');
  
  const form = document.getElementById('effectForm');
  if (!form) {
      logDebug('Error: Effect form not found!');
      return;
  }

  // 保存されている効果を読み込んで適用
  chrome.storage.sync.get('effect', function(data) {
      const currentEffect = data.effect || 'pulse';
      logDebug('Loaded saved effect:', currentEffect);
      
      const radio = document.querySelector(`input[value="${currentEffect}"]`);
      if (radio) {
          radio.checked = true;
          logDebug('Applied saved effect to radio button');
      }
  });

  // ラジオボタンの変更イベントを監視
  document.querySelectorAll('input[type="radio"][name="effect"]').forEach(radio => {
      radio.addEventListener('change', function(e) {
          const selectedEffect = e.target.value;
          logDebug('Effect selected:', selectedEffect);

          // 効果を保存
          chrome.storage.sync.set({ effect: selectedEffect }, function() {
              logDebug('Effect saved to storage');
          });

          // アクティブなタブに効果を適用
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
              if (tabs[0]) {
                  logDebug('Sending effect to content script', selectedEffect);
                  chrome.tabs.sendMessage(tabs[0].id, {
                      action: "updateEffect",
                      effect: selectedEffect
                  });
              }
          });
      });
  });
});