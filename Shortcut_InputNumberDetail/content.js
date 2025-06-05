// Constants
const suggestions = ['金額が合わない', '税額合わない', '差額あり', '差額', '対象額なし', '月8％', '非課税複数']; 
const DOUBLE_PRESS_DELAY = 200;
const KEY_MAPPINGS = {
  'PageDown': 'saveButton',
  ' ': 'saveButton',
  'F1': 'showConfirmationDialog',
  'PageUp': 'simpleTaxTypeCheckbox',
  'c': 'simpleTaxTypeCheckbox',
  'Home': 'simpleTaxTypeConfirmOk',
  'x': 'simpleTaxTypeConfirmOk',
  'Insert': 'noDiscountCheckbox',
  'z': 'noDiscountCheckbox',
 // '.': 'notClearCheckbox',
  'F11': 'notClearCheckbox',
  's': 'notClearCheckbox',
  'F12': 'cannotReadCheckbox',
  'End': 'cannotReadCheckbox',
  'v': 'cannotReadCheckbox',
  'F4': 'clearMemoOpe',
  'Escape': 'navigateToIndex',
  'd': 'focusSecondInput',
 // '/': 'focusSecondInput',
 //  '+': 'focusThirdInput',
  'q': 'focusThirdInput',
 //  '-': 'focusFourthInput',
  'w': 'focusFourthInput',
 // '*': 'focusFifthInput',
  'e': 'focusFifthInput',
  'r': 'focusSixthInput',
  'F5': () => handleFunctionKey(suggestions[0]),
  'F6': () => handleFunctionKey(suggestions[1]),
  'F7': () => handleFunctionKey(suggestions[2]),
  'F8': () => handleFunctionKey(suggestions[3]),
  'F9': () => handleFunctionKey(suggestions[4]),
  'F10': () => handleFunctionKey(suggestions[5]),
  'Pause': 'toggleImageDisplay',
  'a': 'handleTaxInputToggle'
};
const DOUBLE_PRESS_MAPPINGS = {
  'q': 'r',
  'w': 'd'
 // '+': 'r',
 // '-': 'd'
};

// State
let lastPressTimes = {};
const pendingKeys = {};

//
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
if (document.readyState === 'complete') {
  clickElement('#amount_tax_unknown_10')
} else {
  window.addEventListener('load', clickElement('#amount_tax_unknown_10'));
}

////////////////////////////


document.addEventListener('click', function(event) {
  // ターゲットとなるボタンを特定
  if (event.target.matches('.btn-eslacation') && !event.target.dataset.confirmed) {
    // クリックイベントをキャンセル
    event.preventDefault();
    event.stopPropagation();
    
    // 確認ダイアログを表示
    if (confirm('本当にエスカレーションしますか？')) {
      // 「OK」が選択された場合、データ属性を設定してから元のクリックイベントをシミュレート
      event.target.dataset.confirmed = 'true';
      
      // カスタムイベントを作成してディスパッチ
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      event.target.dispatchEvent(clickEvent);
    } else {
      // 「キャンセル」が選択された場合、何もしない
      console.log('ボタンのクリックがキャンセルされました');
    }
  }
}, true);

// 確認済みのボタンクリックを処理
document.addEventListener('click', function(event) {
  if (event.target.matches('.btn-eslacation') && event.target.dataset.confirmed === 'true') {
    // データ属性をリセット
    event.target.dataset.confirmed = 'false';
    
    // ここで実際のクリックアクションを実行
    console.log('ボタンがクリックされました');
    // 例: フォームの送信やAJAXリクエストの実行など
    // event.target.form.submit();
  }
}, false);



// Main Functions
function handleKeyDown(event) {
  const key = normalizeKey(event.key);

  if (event.ctrlKey || event.altKey) return;

  if (DOUBLE_PRESS_MAPPINGS.hasOwnProperty(key)) {
    if (isDoublePress(key)) {
      const mappedKey = DOUBLE_PRESS_MAPPINGS[key];
      console.log(`Double press detected: '${key}' mapped to '${mappedKey}'`);
      simulateKeyPress(mappedKey);
      event.preventDefault();
      clearTimeout(pendingKeys[key]);
      delete pendingKeys[key];
    } else {
      event.preventDefault();
      pendingKeys[key] = setTimeout(() => {
        console.log(`Single press detected: '${key}'`);
        const action = KEY_MAPPINGS[key];
        if (action) {
          executeAction(action, key);
        } else {
          simulateKeyPress(key);
        }
        delete pendingKeys[key];
      }, DOUBLE_PRESS_DELAY);
    }
  } else {
    const action = KEY_MAPPINGS[key];
    if (action) {
      event.preventDefault();
      executeAction(action, key);
    } else {
      console.log(`Key pressed: '${key}'`);
    }
  }
}

function handleKeyUp(event) {
  const key = normalizeKey(event.key);
  if (pendingKeys[key]) {
    clearTimeout(pendingKeys[key]);
    delete pendingKeys[key];
    console.log(`Single press detected: '${key}'`);
    const action = KEY_MAPPINGS[key];
    if (action) {
      executeAction(action, key);
    } else {
      simulateKeyPress(key);
    }
  }
}
function normalizeKey(key) {

    // keyがnullまたはundefinedの場合のガード
    if (!key) return '';
    
  const specialKeys = ['PageDown', 'PageUp', 'Home', 'Insert', 'End', 'Escape', 'Pause'];
  const functionKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
  
  if (specialKeys.includes(key) || functionKeys.includes(key)) {
      return key;
  }
  return key.toLowerCase();
}


function executeAction(action, key) {
  if (typeof action === 'function') {
    action();
  } else {
    performAction(action);
  }
}


function isDoublePress(key) {
  const currentTime = Date.now();
  const lastPressTime = lastPressTimes[key] || 0;
  const timeSinceLastPress = currentTime - lastPressTime;
  
  lastPressTimes[key] = currentTime;

  return timeSinceLastPress < DOUBLE_PRESS_DELAY;
}

function simulateKeyPress(key) {
  // キープレスをシミュレート
  const downEvent = new KeyboardEvent('keydown', {
    key: key,
    bubbles: true,
    cancelable: true,
  });
  const upEvent = new KeyboardEvent('keyup', {
    key: key,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(downEvent);
  document.dispatchEvent(upEvent);
}


function performAction(action) {
  switch (action) {
    case 'saveButton':
        clickElement('.btn-save');
        break;
    case 'showConfirmationDialog':
        clickElement('.btn-eslacation');
        //showConfirmationDialog();
        break;
    case 'simpleTaxTypeCheckbox':
        clickElement('input[name="simple_tax_type"]');
        break;
    case 'simpleTaxTypeConfirmOk':
        clickElement('#simple_tax_type_confirm_ok');
        break;
    case 'noDiscountCheckbox':
        clickElement('#no_discount');
        break;
    case 'notClearCheckbox':
        clickElement('#not_clear');
        break;
    case 'cannotReadCheckbox':
        clickElement('#cannot_read');
        break;
    case 'clearMemoOpe':
        clearAndFocusElement('#memo-ope');
        break;
    case 'navigateToIndex':
        navigateToIndex();
        break;
    case 'focusSecondInput':
      clickElement('#amount_substract');
         break;
    case 'focusThirdInput':
      clickElement('#amount_tax_unknown_10');
          break;
    case 'focusFourthInput':
      clickElement('#amount_tax_unknown_8_reduced');
         break;
    case 'focusFifthInput':
      clickElement('#amount_tax_free');
        break;
    case 'focusSixthInput':
      clickElement('#amount_tax_light_oil');
      break;
    case 'toggleImageDisplay':
        toggleImageDisplay();
        break;
    case 'handleTaxInputToggle':
        handleTaxInputToggle();
        break;    
}

}


// Helper Functions
function clickElement(selector) {
  const element = document.querySelector(selector);
  if (element && !element.disabled) {

    element.click();
    
    if ((element.tagName === 'INPUT' && element.type !== 'checkbox') || 
        element.tagName === 'TEXTAREA') {
      try {
        element.select();
      } catch (e) {}
    }
  }
}

function clearAndFocusElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
      element.focus();
      element.value = '';
  }
}

function navigateToIndex() {
  const singleDocLink = document.querySelector('li.dropdown.active > a.dropdown-toggle');
  if (singleDocLink) {
      singleDocLink.click();
      setTimeout(() => {
          const indexLink = document.querySelector('li.dropdown.active .dropdown-menu a[href="/receipt2/verification"]');
          if (indexLink) {
              indexLink.click();
          } else {
              console.log("'index' link not found");
          }
      }, 150);
  } else {
      console.log("'Single Doc' dropdown not found");
  }
}


function handleFunctionKey(assignedString) {
  const memo = document.querySelector('#memo-ope');

  hideSuggestions();/////////////////////////////


  if (memo) {
      memo.focus();
      document.activeElement.value += assignedString;
  }
}

// Confirmation Dialog
/*let isDialogOpen = false;

function showConfirmationDialog() {
  if (isDialogOpen) return;
  
  isDialogOpen = true;

  hideSuggestions();///////////////////////


  const dialog = createDialogElement();
  document.body.appendChild(dialog);

  const cancelButton = dialog.querySelector('#cancelButton');
  cancelButton.addEventListener('click', closeDialog);

  document.addEventListener('keydown', handleF2);

  function handleF2(e) {
      if (e.key === 'F2') {
          e.preventDefault();
          clickElement('.btn-eslacation');
          closeDialog();
      }
  }

  function closeDialog() {
      document.body.removeChild(dialog);
      document.removeEventListener('keydown', handleF2);
      isDialogOpen = false;
  }
}

function createDialogElement() {
  const dialog = document.createElement('div');
  dialog.id = 'confirmationDialog';
  dialog.innerHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                  background-color: white; padding: 20px; border: 1px solid black; z-index: 1000;">
          <p>エスカレーションしますか？ F2キーを押して確認してください。</p>
          <button id="cancelButton">キャンセル</button>
      </div>
  `;
  return dialog;
}
*/

////////////////////////////////
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
      updateFieldStyle(mutation.target);
    }
  });
});

function applyCurrentEffect(element) {
  if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
    element.classList.remove('pulse', 'flame', 'rainbow');
    element.classList.add(currentEffect);
  }
}

// グローバル変数を追加
let currentEffect = 'pulse';

// イベントリスナーを更新
function initializeFields() {
  document.querySelectorAll('input, textarea').forEach(field => {
    field.classList.add('highlight-focus');
    field.addEventListener('focus', (e) => {
      handleFocus(e);
      applyCurrentEffect(e.target);
      if (e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          e.target.select();
        }, 0);
      }
    });
    field.addEventListener('blur', handleBlur);
    field.addEventListener('input', handleInput);
    updateFieldStyle(field);
    observer.observe(field, { attributes: true });
  });
}

function updateFieldStyle(field) {
  if (field.disabled) {
    field.classList.remove('highlight-value');
  } else if (field.value.trim() !== '') {
    field.classList.add('highlight-value');
  } else {
    field.classList.remove('highlight-value');
  }
}

function handleFocus(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    e.target.classList.add('highlight-focus');
    e.target.classList.remove('highlight-value');
  }
}

function handleBlur(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    updateFieldStyle(e.target);
  }
}

function handleInput(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (!e.target.matches(':focus')) {
      updateFieldStyle(e.target);
    }
  }
}



// DOMContentLoadedイベントを使用して初期化
document.addEventListener('DOMContentLoaded', () => {
  initializeFields();
  clickElement('#amount_tax_unknown_10');
});


// ページ読み込み完了時にも初期化を行う（動的に追加される要素のため）
//window.addEventListener('load', initializeFields);

///////////////////////////////
const targetInput = document.querySelector('#memo-ope'); // 対象の入力フィールドのセレクタを適切に変更してください


const wrapper = document.createElement('div');
wrapper.className = 'autocomplete-wrapper';
targetInput.parentNode.insertBefore(wrapper, targetInput);
wrapper.appendChild(targetInput);

const suggestionList = document.createElement('ul');
suggestionList.className = 'autocomplete-suggestions';
wrapper.appendChild(suggestionList);

// 入力フィールドのスタイルを保持
const inputStyles = window.getComputedStyle(targetInput);
wrapper.style.display = inputStyles.display;
wrapper.style.width = inputStyles.width;
targetInput.style.width = '100%';

// ドロップダウンリストの幅を設定
function adjustSuggestionListWidth() {
  const inputRect = targetInput.getBoundingClientRect();
  suggestionList.style.width = `${inputRect.width}px`;
}

function updateSuggestions() {
  const value = targetInput.value.toLowerCase();
  const filteredSuggestions = value
    ? suggestions.filter(suggestion => suggestion.toLowerCase().includes(value))
    : suggestions;

  suggestionList.innerHTML = '';
  filteredSuggestions.forEach(suggestion => {
    const li = document.createElement('li');
    li.textContent = suggestion;
    li.addEventListener('mousedown', function(e) {
      e.preventDefault(); // フォーカスが外れるのを防ぐ
    });
    li.addEventListener('click', function() {
      targetInput.value = suggestion;
      hideSuggestions();
    });
    suggestionList.appendChild(li);
  });

  if (filteredSuggestions.length > 0) {
    showSuggestions();
  } else {
    hideSuggestions();
  }
}

function showSuggestions() {
  adjustSuggestionListWidth();
  suggestionList.style.display = 'block';
}

function hideSuggestions() {
  suggestionList.style.display = 'none';
}

targetInput.addEventListener('input', updateSuggestions);
targetInput.addEventListener('focus', updateSuggestions);
wrapper.addEventListener('mouseenter', showSuggestions);

// フォーカスが外れた時にリストを閉じる
targetInput.addEventListener('blur', function(e) {
  // リスト内のクリックイベントを処理するための小さな遅延
  setTimeout(() => {
    hideSuggestions();
  }, 200);
});

// ウィンドウのリサイズ時にドロップダウンリストの幅を調整
window.addEventListener('resize', adjustSuggestionListWidth);

// キーボードナビゲーション
targetInput.addEventListener('keydown', function(e) {
  if (suggestionList.style.display === 'none') return;

  const items = suggestionList.getElementsByTagName('li');
  let index = Array.from(items).findIndex(item => item.classList.contains('selected'));

  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (index < items.length - 1) index++;
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (index > 0) index--;
      break;
    case 'Enter':
      e.preventDefault();
      if (index !== -1) {
        targetInput.value = items[index].textContent;
        hideSuggestions();
      }
      return;
    case 'Escape':
      hideSuggestions();
      return;
    default:
      return;
  }

  Array.from(items).forEach(item => item.classList.remove('selected'));
  if (index !== -1) {
    items[index].classList.add('selected');
    items[index].scrollIntoView({ block: 'nearest' });
  }
});

/////////////////////////////////////////////////税額値入れ替え

function getFields() {
  return {
    fields10Percent: [
      document.getElementById('amount_tax_unknown_10'),
      document.getElementById('amount_tax_10')
    ],
    fields8Percent: [
      document.getElementById('amount_tax_unknown_8_reduced'),
      document.getElementById('amount_tax_8_reduced')
    ]
  };
}

function swapFieldValues(field1, field2) {
  const value1 = field1.value;
  const value2 = field2.value;

  const updateValue = (field, value) => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));

    if (field._valueTracker) {
      field._valueTracker.setValue(value);
    }
  };

  updateValue(field1, value2);
  updateValue(field2, value1);

  console.log('Swapped values:', {
    field1: { id: field1.id, oldValue: value1, newValue: field1.value },
    field2: { id: field2.id, oldValue: value2, newValue: field2.value }
  });
}

function focusAndBlurFields(fields) {
  const activeElement = document.activeElement;
  
  fields.forEach((field, index) => {
    setTimeout(() => {
      field.focus();
      field.blur();
      
      if (index === fields.length - 1) {
        setTimeout(() => {
          if (activeElement) {
            activeElement.focus();
          }
        }, 0);
      }
    }, index * 50);
  });
}

function handleTaxInputToggle() {
  const { fields10Percent, fields8Percent } = getFields();

  if (fields10Percent[0] && fields8Percent[0]) {
    fields10Percent.forEach((field10, index) => {
      const field8 = fields8Percent[index];
      if (field10 && field8) {
        swapFieldValues(field10, field8);
      }
    });

    focusAndBlurFields([...fields10Percent, ...fields8Percent]);
  } else {
    console.log('Tax input fields not found.');
  }
}
////////税額候補表示

// 消費税計算と表示機能 
(function() {
  // デバッグモード
  const DEBUG = true;
  const log = DEBUG ? console.log.bind(console) : function() {};
  
  // 初期化時に実行
  function initializeTaxCalculationDisplay() {
    log("税額計算表示機能を初期化しています...");
    
    // 税率設定
    const TAX_RATE_STANDARD = 0.10;  // 標準税率 10%
    const TAX_RATE_REDUCED = 0.08;   // 軽減税率 8%
    
    // まず既存のツールチップがあれば削除
    document.querySelectorAll('[id^="tax-tooltip-"]').forEach(el => el.remove());
    document.querySelectorAll('#tax-tooltip-styles').forEach(el => el.remove());
    
    // 必要なフィールド要素を取得
    const fields = {
      input10: document.getElementById('amount_tax_unknown_10'),
      input8: document.getElementById('amount_tax_unknown_8_reduced'),
      tax10: document.getElementById('amount_tax_10'),
      tax8: document.getElementById('amount_tax_8_reduced')
    };
    
    // フィールドが存在するか確認
    if (!fields.input10 || !fields.input8 || !fields.tax10 || !fields.tax8) {
      console.error('必要なフィールドが見つかりません');
      return;
    }
    
    // スタイルを追加
    addStyles();
    
    // ツールチップを作成
    const tooltips = {
      standard: createTooltip('standard', TAX_RATE_STANDARD),
      reduced: createTooltip('reduced', TAX_RATE_REDUCED)
    };
    
    // ポーリング用変数
    let standardPollingId = null;
    let reducedPollingId = null;
    
    function calculateTax(amount, rate, type, useDirect = false) {
      // 入力値を整数化（センテリティを維持）
      const intAmount = Math.floor(amount);
      
      if (type === 'inclusive') {
        if (useDirect) {
          // 直接計算方式（税額を直接計算）
          const taxRate = rate / (1 + rate);
          return Math.floor(intAmount * taxRate);
        } else {
          // 国税庁方式（税抜金額を計算してから税額を算出）
          const taxExcludedAmount = Math.floor(intAmount / (1 + rate));
          return intAmount - taxExcludedAmount;
        }
      } else if (type === 'exclusive-adjusted') {
    // 伝票調整用外税計算 - 切り上げ処理を使用
    const adjustedBase = intAmount;
    return Math.ceil(adjustedBase * rate); // ここを切り上げに変更
      } else {
        // 通常の外税計算
        return Math.floor(intAmount * rate);
      }
    }
    
    // 監視処理本体
    function startMonitoring() {
      // イベントセットアップ
      setupFieldEvents('standard');
      setupFieldEvents('reduced');
      
      // ポーリングによる継続的なチェック開始
      startPolling();
      
      // グローバルイベント
      setupGlobalEvents();
      
      log("監視処理を開始しました");
    }
    
    // ポーリングによる継続的なチェック
    function startPolling() {
      // 既存のポーリングを停止
      stopPolling();
      
      // 新しいポーリングを開始（60FPSに近い頻度で更新）
      standardPollingId = setInterval(() => checkAndUpdateTooltip('standard'), 17);
      reducedPollingId = setInterval(() => checkAndUpdateTooltip('reduced'), 17);
      
      log("ポーリングによる監視を開始しました");
    }
    
    // ポーリングを停止
    function stopPolling() {
      if (standardPollingId) clearInterval(standardPollingId);
      if (reducedPollingId) clearInterval(reducedPollingId);
      standardPollingId = null;
      reducedPollingId = null;
    }
    
    // フィールドのイベント設定
    function setupFieldEvents(type) {
      const inputField = type === 'standard' ? fields.input10 : fields.input8;
      const taxField = type === 'standard' ? fields.tax10 : fields.tax8;
      
      // フォーカスイベント
      inputField.addEventListener('focus', () => setActiveField(type, 'input'));
      taxField.addEventListener('focus', () => setActiveField(type, 'tax'));
      
      // ブラーイベント
      inputField.addEventListener('blur', handleBlur);
      taxField.addEventListener('blur', handleBlur);
      
      // 直接的な値変更イベント
      const events = ['input', 'change', 'keyup', 'keydown', 'keypress', 'paste', 'cut'];
      events.forEach(eventName => {
        inputField.addEventListener(eventName, () => setTimeout(() => checkAndUpdateTooltip(type), 0));
        taxField.addEventListener(eventName, () => setTimeout(() => checkAndUpdateTooltip(type), 0));
      });
      
      log(`${type}のフィールドイベントを設定しました`);
    }
    
    // グローバルイベント設定
    function setupGlobalEvents() {
      // ウィンドウリサイズ
      window.addEventListener('resize', () => {
        checkAndUpdateTooltip('standard');
        checkAndUpdateTooltip('reduced');
      });
      
      // グローバルキーイベント
      document.addEventListener('keydown', () => {
        if (document.activeElement === fields.tax10) {
          checkAndUpdateTooltip('standard');
        } else if (document.activeElement === fields.tax8) {
          checkAndUpdateTooltip('reduced');
        }
      });
      
      // マウスクリック
      document.addEventListener('mousedown', () => {
        checkAndUpdateTooltip('standard');
        checkAndUpdateTooltip('reduced');
      });
    }
    
    // アクティブなフィールドを設定
    function setActiveField(type, fieldType) {
      log(`${type}の${fieldType}フィールドがアクティブになりました`);
      checkAndUpdateTooltip(type);
    }
    
    // ブラー処理
    function handleBlur(e) {
      // 関連フィールド間の移動は無視
      const relatedFields = [fields.input10, fields.tax10, fields.input8, fields.tax8];
      if (relatedFields.includes(e.relatedTarget)) return;
      
      // 少し遅延させて非表示に
      setTimeout(() => {
        // どのフィールドにもフォーカスがなければ非表示
        const hasFieldFocus = relatedFields.some(field => document.activeElement === field);
        if (!hasFieldFocus) {
          tooltips.standard.element.classList.remove('visible');
          tooltips.reduced.element.classList.remove('visible');
          log("フォーカスがなくなったためツールチップを非表示にしました");
        }
      }, 100);
    }
    
    // ツールチップの確認と更新
    function checkAndUpdateTooltip(type) {
      const tooltip = tooltips[type];
      const inputField = type === 'standard' ? fields.input10 : fields.input8;
      const taxField = type === 'standard' ? fields.tax10 : fields.tax8;
      
      // フォーカスの確認
      const isActive = document.activeElement === inputField || document.activeElement === taxField;
      
      // 値の確認
      const inputValue = inputField.value.trim().replace(/,/g, '');
      const taxValue = taxField.value.trim().replace(/,/g, '');
      
      // 値またはフォーカスがなければ非表示
      if ((!inputValue && !taxValue) || !isActive) {
        tooltip.element.classList.remove('visible');
        return;
      }
      
      // 対象額があれば計算
      const amount = parseFloat(inputValue) || 0;
      const rate = type === 'standard' ? TAX_RATE_STANDARD : TAX_RATE_REDUCED;
      
      // 税額計算 - 各種計算方法で実施
      const inclusiveTaxNTA = calculateTax(amount, rate, 'inclusive', false);
      const inclusiveTaxDirect = calculateTax(amount, rate, 'inclusive', true);
      const exclusiveTax = calculateTax(amount, rate, 'exclusive');
      const exclusiveTaxAdjusted = calculateTax(amount, rate, 'exclusive-adjusted');
      
      // 表示を更新
      tooltip.inclusiveElement.textContent = `${inclusiveTaxNTA.toLocaleString()}円`;
      tooltip.inclusiveAltElement.textContent = `${inclusiveTaxDirect.toLocaleString()}円`;
      tooltip.exclusiveElement.textContent = `${exclusiveTax.toLocaleString()}円`;
      tooltip.exclusiveAdjustedElement.textContent = `${exclusiveTaxAdjusted.toLocaleString()}円`;
      
      // 外税の差異があれば強調表示
      const hasTaxDiscrepancy = exclusiveTax !== exclusiveTaxAdjusted;
      tooltip.noteElement.style.display = hasTaxDiscrepancy ? 'block' : 'none';
      
      if (hasTaxDiscrepancy) {
        // 差異の説明を詳細に表示
        tooltip.noteElement.textContent = `外税の差異(${Math.abs(exclusiveTax - exclusiveTaxAdjusted)}円): 標準は対象額×税率、伝票調整は端数を切り上げ計算`;
        // 説明要素にクラスを追加
        tooltip.noteElement.classList.add('has-discrepancy');
      } else {
        tooltip.noteElement.classList.remove('has-discrepancy');
      }
      
      // 税額フィールドの値
      const currentTaxText = taxValue.replace(/[^\d]/g, '');
      
      // 一致チェック（部分一致も含む）
      checkMatching(tooltip.inclusiveElement, String(inclusiveTaxNTA), currentTaxText);
      checkMatching(tooltip.inclusiveAltElement, String(inclusiveTaxDirect), currentTaxText);
      checkMatching(tooltip.exclusiveElement, String(exclusiveTax), currentTaxText);
      checkMatching(tooltip.exclusiveAdjustedElement, String(exclusiveTaxAdjusted), currentTaxText);
      
      // 逆方向のマッチング: 対象額フィールドがフォーカスされている場合
      if (document.activeElement === inputField && taxValue) {
        const currentTax = parseInt(currentTaxText) || 0;
        
        // 各計算方法での逆算
        const suggestedAmounts = {
          nta: calculateReverseAmount(currentTax, rate, false),
          direct: calculateReverseAmount(currentTax, rate, true),
          exclusive: Math.ceil(currentTax / rate),
          exclusiveAdjusted: calculateReverseExclusiveAdjusted(currentTax, rate)
        };
        
        // 現在入力中の値
        const currentInputText = inputValue.replace(/[^\d]/g, '');
        
        // 一致判定
        const isMatching = {
          nta: String(suggestedAmounts.nta).includes(currentInputText) || currentInputText.includes(String(suggestedAmounts.nta)),
          direct: String(suggestedAmounts.direct).includes(currentInputText) || currentInputText.includes(String(suggestedAmounts.direct)),
          exclusive: String(suggestedAmounts.exclusive).includes(currentInputText) || currentInputText.includes(String(suggestedAmounts.exclusive)),
          exclusiveAdjusted: String(suggestedAmounts.exclusiveAdjusted).includes(currentInputText) || currentInputText.includes(String(suggestedAmounts.exclusiveAdjusted))
        };
        
        // 一致するものがあれば表示
        if (isMatching.nta || isMatching.direct || isMatching.exclusive || isMatching.exclusiveAdjusted) {
          tooltip.element.setAttribute('data-has-input-match', 'true');
          
          if (isMatching.nta) tooltip.inclusiveElement.setAttribute('data-reverse-match', `対象額: ${suggestedAmounts.nta.toLocaleString()}円`);
          if (isMatching.direct) tooltip.inclusiveAltElement.setAttribute('data-reverse-match', `対象額: ${suggestedAmounts.direct.toLocaleString()}円`);
          if (isMatching.exclusive) tooltip.exclusiveElement.setAttribute('data-reverse-match', `対象額: ${suggestedAmounts.exclusive.toLocaleString()}円`);
          if (isMatching.exclusiveAdjusted) tooltip.exclusiveAdjustedElement.setAttribute('data-reverse-match', `対象額: ${suggestedAmounts.exclusiveAdjusted.toLocaleString()}円`);
        } else {
          resetReverseMatches(tooltip);
        }
      } else {
        resetReverseMatches(tooltip);
      }
      
      // ツールチップの位置を調整
      const rect = taxField.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // 税額フィールドの右隣に配置
      tooltip.element.style.top = `${rect.top + scrollTop - 10}px`;
      tooltip.element.style.left = `${rect.right + scrollLeft + 15}px`;
      
      // 最前面に配置
      document.body.appendChild(tooltip.element);
      
      // 表示
      tooltip.element.classList.add('visible');
    }
    
    // 逆計算マッチングの属性をリセット
    function resetReverseMatches(tooltip) {
      tooltip.element.removeAttribute('data-has-input-match');
      tooltip.inclusiveElement.removeAttribute('data-reverse-match');
      tooltip.inclusiveAltElement.removeAttribute('data-reverse-match');
      tooltip.exclusiveElement.removeAttribute('data-reverse-match');
      tooltip.exclusiveAdjustedElement.removeAttribute('data-reverse-match');
    }
    
    // 外税（伝票調整）の逆算 - 税額から対象額を推測
    function calculateReverseExclusiveAdjusted(taxAmount, rate) {
      if (taxAmount <= 0) return 0;
      
      // 可能性のある対象額範囲を探索
      for (let baseAmount = Math.floor(taxAmount / rate) - 1; baseAmount <= Math.ceil(taxAmount / rate) + 1; baseAmount++) {
        // 整数の対象額でのみチェック
        const truncatedAmount = Math.floor(baseAmount);
        const calculatedTax = Math.floor(truncatedAmount * rate);
        
        if (calculatedTax === taxAmount) {
          return truncatedAmount;
        }
      }
      
      // 見つからない場合は概算値
      return Math.floor(taxAmount / rate);
    }
    
// 既存のcheckMatching関数を修正
function checkMatching(element, value, input) {
  if (!input) {
    element.classList.remove('matching', 'partial-matching', 'exact-matching');
    return;
  }
  
  // 完全一致のチェック
  const isExactMatch = value === input;
  
  // 部分一致のチェック（完全一致でなく、かつ部分的に一致する場合）
  const isPartialMatch = !isExactMatch && input.length > 0 && 
                         (value.includes(input) || input.includes(value));
  
  // クラスをすべて削除してからチェック結果に基づいて適用
  element.classList.remove('matching', 'partial-matching', 'exact-matching');
  
  if (isExactMatch) {
    element.classList.add('matching', 'exact-matching');
  } else if (isPartialMatch) {
    element.classList.add('matching', 'partial-matching');
  }
}
    
    // 税額から対象額を逆算
    function calculateReverseAmount(taxAmount, rate, useDirect = false) {
      if (taxAmount <= 0) return 0;
      
      if (useDirect) {
        // 直接計算方式の逆算
        // 税額 = 対象額 × (rate / (1 + rate)) の逆算
        const taxRate = rate / (1 + rate);
        return Math.round(taxAmount / taxRate);
      } else {
        // 国税庁方式の逆算
        // より複雑なので近似値を探す
        let amount = taxAmount * 10; // 初期推測値
        let calculatedTax = 0;
        
        // 繰り返し計算で最適値を探索（二分探索）
        let min = 0;
        let max = taxAmount * 20; // 上限設定
        
        for (let i = 0; i < 20; i++) { // 最大20回の繰り返し
          calculatedTax = calculateTax(amount, rate, 'inclusive', false);
          
          if (calculatedTax === taxAmount) {
            // 一致した場合はその値を返す
            return amount;
          } else if (calculatedTax < taxAmount) {
            // 計算された税額が小さい場合は下限を上げる
            min = amount;
          } else {
            // 計算された税額が大きい場合は上限を下げる
            max = amount;
          }
          
          // 次の推測値
          amount = Math.floor((min + max) / 2);
        }
        
        // 最も近い値を返す
        return amount;
      }
    }
    
    // スタイルを追加
    function addStyles() {
      const styleElement = document.createElement('style');
      styleElement.id = 'tax-tooltip-styles';
      styleElement.textContent = `
        .tax-tooltip {
          position: absolute;
          background-color: rgba(25, 25, 112, 0.85);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.7);
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
          z-index: 99999;
          font-size: 16px;
          width: 320px;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          transform: translateX(-10px);
          pointer-events: none;
          display: none;
        }
        
        .tax-tooltip.visible {
          opacity: 0.95;
          transform: translateX(0);
          display: block;
        }
        
        .tax-tooltip-title {
          font-weight: bold;
          font-size: 18px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.5);
          text-align: center;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .tax-tooltip-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-gap: 12px;
          margin-bottom: 5px;
        }
        
        .tax-label {
          font-weight: bold;
          color: rgba(255, 255, 255, 0.9);
          font-size: 15px;
        }
        
        .tax-value {
          text-align: right;
          font-weight: bold;
          font-size: 22px;
          color: #FFFF99;
          text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.4);
          padding: 2px 5px;
          border-radius: 4px;
          transition: all 0.15s ease;
          position: relative;
        }
        
        /* 完全一致のスタイル */
        .tax-value.exact-matching {
          border: 2px solid #FFFFFF;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
          background-color: rgba(255, 51, 51, 0.3);
          color: #FFFFFF;
          animation: pulse-exact-highlight 0.8s infinite alternate;
        }
        
        /* 部分一致のスタイル */
        .tax-value.partial-matching {
          border: 2px solid #FF3333;
          box-shadow: 0 0 8px rgba(255, 51, 51, 0.7);
          background-color: rgba(255, 51, 51, 0.2);
          color: #FFFF99;
          animation: pulse-partial-highlight 0.8s infinite alternate;
        }
        
        .tax-value.inclusive-tax-alt {
          color: #AAFFAA;
        }
        
        .tax-value.exclusive-tax-adjusted {
          color: #FFA500;
          font-size: 20px;
        }
        
        .tax-note {
          font-size: 11px;
          padding: 4px 8px;
          background-color: rgba(255, 165, 0, 0.3);
          border-radius: 4px;
          margin-top: 5px;
          border-left: 3px solid #FFA500;
          opacity: 0.9;
          transition: opacity 0.3s ease;
        }
        
        .tax-note.has-discrepancy {
          animation: highlight-note 1.5s ease infinite alternate;
          border-left: 3px solid #FF6347;
        }
        
        @keyframes highlight-note {
          from { background-color: rgba(255, 165, 0, 0.3); }
          to { background-color: rgba(255, 99, 71, 0.4); }
        }
        
        /* 完全一致のアニメーション */
        @keyframes pulse-exact-highlight {
          from {
            box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
          }
          to {
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.9);
          }
        }
        
        /* 部分一致のアニメーション */
        @keyframes pulse-partial-highlight {
          from {
            box-shadow: 0 0 8px rgba(255, 51, 51, 0.7);
          }
          to {
            box-shadow: 0 0 15px rgba(255, 51, 51, 0.9);
          }
        }
        
        /* 対象額フィールドへの入力時の逆算マッチング表示 */
        .tax-value[data-reverse-match]::after {
          content: attr(data-reverse-match);
          position: absolute;
          top: -25px;
          right: 0;
          font-size: 12px;
          background-color: rgba(255, 204, 0, 0.9);
          color: #000;
          padding: 2px 6px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          animation: float-hint 2s infinite alternate;
        }
        
        @keyframes float-hint {
          from { transform: translateY(0); }
          to { transform: translateY(-3px); }
        }
        
        /* 税率別カラーバリエーション */
        .tax-tooltip-standard {
          background: linear-gradient(135deg, rgba(70, 70, 200, 0.85) 0%, rgba(25, 25, 112, 0.9) 100%);
        }
        
        .tax-tooltip-reduced {
          background: linear-gradient(135deg, rgba(60, 120, 180, 0.85) 0%, rgba(20, 60, 120, 0.9) 100%);
        }
      `;
      
      document.head.appendChild(styleElement);
      console.log("スタイルシートを追加しました");
    }
    // ツールチップを作成
    function createTooltip(type, rate) {
      const tooltip = document.createElement('div');
      tooltip.id = `tax-tooltip-${type}`;
      tooltip.className = `tax-tooltip tax-tooltip-${type}`;
      tooltip.setAttribute('data-rate', rate);
      
      tooltip.innerHTML = `
        <div class="tax-tooltip-title">
          ${type === 'standard' ? '10%' : '8%'} 税額計算
        </div>
        <div class="tax-tooltip-content">
          <div class="tax-label">内税(A):</div>
          <div class="tax-value inclusive-tax">0円</div>
          <div class="tax-label">内税(B):</div>
          <div class="tax-value inclusive-tax-alt">0円</div>
          <div class="tax-label">外税:</div>
          <div class="tax-value exclusive-tax">0円</div>
          <div class="tax-label">外税(調整):</div>
          <div class="tax-value exclusive-tax-adjusted">0円</div>
        </div>
        <div style="margin-top: 5px; font-size: 11px; color: rgba(255,255,255,0.7); border-top: 1px dotted rgba(255,255,255,0.5); padding-top: 3px;">
          A:国税庁方式 B:直接計算方式
        </div>
        <div class="tax-note" style="margin-top: 3px; font-size: 11px; color: rgba(255,255,255,0.8);">
          外税の差異: 伝票記載額の切り捨て処理による
        </div>
      `;
      
      document.body.appendChild(tooltip);
      
      return {
        element: tooltip,
        inclusiveElement: tooltip.querySelector('.inclusive-tax'),
        inclusiveAltElement: tooltip.querySelector('.inclusive-tax-alt'),
        exclusiveElement: tooltip.querySelector('.exclusive-tax'),
        exclusiveAdjustedElement: tooltip.querySelector('.exclusive-tax-adjusted'),
        noteElement: tooltip.querySelector('.tax-note')
      };
    }
    
    // 監視処理開始
    startMonitoring();
    
    // 初期状態のチェック
    setTimeout(() => {
      checkAndUpdateTooltip('standard');
      checkAndUpdateTooltip('reduced');
    }, 500);
    
    log("税額計算表示機能の初期化が完了しました");
    
    // ウィンドウをまたいだ参照防止のためオブジェクトを返さない
    return true;
  }
  
  // DOMContentLoadedイベントで初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTaxCalculationDisplay);
  } else {
    // すでにDOMが読み込まれている場合
    initializeTaxCalculationDisplay();
  }
  
  // 追加の保険として、load時にも初期化を試みる
  window.addEventListener('load', () => {
    if (!document.querySelector('[id^="tax-tooltip-"]')) {
      initializeTaxCalculationDisplay();
    }
  });
})();


// Image Display//////////////////////////////////////////////
let isImageDisplayed = false;
let container = null;
let isDragging = false;
let startX, startY, initialLeft, initialTop;
let currentScale = 1;

function toggleImageDisplay() {
  if (!isImageDisplayed) {
      chrome.runtime.sendMessage({action: "showImage"});
  } else {
      removeImage();
  }
}

function removeImage() {
  if (isImageDisplayed && container) {
      document.body.removeChild(container);
      isImageDisplayed = false;
      container = null;
      currentScale = 1;
  }
}

function createAndDisplayImage() {
  if (isImageDisplayed) return;

  isImageDisplayed = true;
  
  container = createImageContainer();
  const img = createImage();
  container.appendChild(img);
  document.body.appendChild(container);

  setInitialPosition();

  container.addEventListener('mousedown', startDragging);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDragging);
  container.addEventListener('dblclick', removeImage);
  container.addEventListener('wheel', zoom);
}

function createImageContainer() {
  const container = document.createElement('div');
  Object.assign(container.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '9999',
      width: '50%',
      height: 'auto',
      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
      cursor: 'move'
  });
  return container;
}

function createImage() {
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('images/display_image.png');
  Object.assign(img.style, {
      width: '100%',
      height: 'auto',
      opacity: '0.8',
      transition: 'transform 0.1s ease-out'
  });
  return img;
}

function setInitialPosition() {
  const rect = container.getBoundingClientRect();
  container.style.top = rect.top + 'px';
  container.style.left = rect.left + 'px';
  container.style.transform = 'none';
}

function startDragging(e) {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialLeft = container.offsetLeft;
  initialTop = container.offsetTop;
  if (container) container.style.cursor = 'grabbing';
}

function stopDragging() {
  isDragging = false;
  if (container) container.style.cursor = 'move';
}

function drag(e) {
  if (isDragging && container) {
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.left = `${initialLeft + dx}px`;
      container.style.top = `${initialTop + dy}px`;
  }
}

function zoom(e) {
  e.preventDefault();
  const delta = e.deltaY || e.detail || e.wheelDelta;

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (delta > 0) {
      currentScale = Math.max(0.1, currentScale - 0.1);
  } else {
      currentScale = Math.min(5, currentScale + 0.1);
  }

  const img = container.querySelector('img');
  img.style.transform = `scale(${currentScale})`;

  // Adjust position to zoom centered on mouse
  const newLeft = rect.left + mouseX - (mouseX * currentScale / (currentScale - 0.1));
  const newTop = rect.top + mouseY - (mouseY * currentScale / (currentScale - 0.1));

  container.style.left = `${newLeft}px`;
  container.style.top = `${newTop}px`;
}

// Message Listener

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.effect) {
    const focusedElement = document.activeElement;
    console.log('Effect requested:', request.effect);
    if (focusedElement && (focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'TEXTAREA')) {
      // 以前のエフェクトを削除
      focusedElement.classList.remove('pulse', 'flame', 'rainbow');
      // 新しいエフェクトを追加
      focusedElement.classList.add(request.effect);
      console.log('New effect applied:', request.effect);
      
      // グローバル変数を更新
      currentEffect = request.effect;
    }
  }
  if (request.action === "displayImage") {
    createAndDisplayImage();
}
});




////////////////////////////////// オペレータメモの説明を表示する機能
// オペレータメモの説明をリアルタイムで吹き出し表示する機能
(function() {
  // メモとその意味のマッピング
  const MEMO_MEANINGS = {
    '金額が合わない': '伝票上の金額と入力値が合わず、差額がOKにならない',
    '税額合わない': '対象額と税額の計算が合わず、消費税額の入力欄右に警告マークが表示されてしまう',
    '差額あり': '軽油税以外の源泉徴収・利用税・宿泊税・入湯税など特殊な税額と差額が一致する',
    '差額': '伝票上に軽油税が記載されており、差額が軽油税と一致するにもかかわらず、軽油税の入力欄が表示されていない',
    '対象額なし': '伝票上に消費税の対象額が記載されておらず、消費税額のみが記載されている',
    '月8％': '２０１９年１０月以前の伝票上に８％の消費税が存在する（※該当月の数字を先頭に入れる）',
    '非課税複数': '伝票上に非課税の合計額がなく、複数の非課税額が記載されている'
  };

     // スタイルの追加
  function addStyles() {
    if (document.getElementById('memo-speech-bubble-styles')) return;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'memo-speech-bubble-styles';
    styleSheet.textContent = `
      .memo-explanation-bubble {
        position: absolute;
        top: -5px;
        left: calc(100% + 15px);
        background-color: #f0f8ff;
        border: 2px solid #4682b4;
        border-radius: 8px;
        padding: 10px 15px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        width: 280px;
        z-index: 9999;
        font-size: 14px;
        opacity: 0;
        visibility: hidden;
        transition: all 0.25s ease;
        transform: translateX(-10px);
      }
      
      .memo-explanation-bubble.visible {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
      }
      
      .memo-explanation-bubble::before {
        content: '';
        position: absolute;
        top: 15px;
        left: -10px;
        border-width: 10px 10px 10px 0;
        border-style: solid;
        border-color: transparent #4682b4 transparent transparent;
      }
      
      .memo-explanation-bubble::after {
        content: '';
        position: absolute;
        top: 15px;
        left: -7px;
        border-width: 10px 10px 10px 0;
        border-style: solid;
        border-color: transparent #f0f8ff transparent transparent;
      }
      
      .memo-match-item {
        padding: 8px;
        margin: 5px 0;
        border-radius: 6px;
        background-color: rgba(70, 130, 180, 0.08);
        border: 1px solid rgba(70, 130, 180, 0.2);
      }
      
      .memo-match-title {
        font-weight: bold;
        font-size: 15px;
        color: #2c5777;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(70, 130, 180, 0.2);
        margin-bottom: 6px;
      }
      
      .memo-match-meaning {
        color: #333;
        line-height: 1.5;
        font-size: 13px;
      }
      
      .memo-no-matches {
        color: #888;
        font-style: italic;
        padding: 5px 0;
      }
      
      .memo-no-content {
        color: #666;
        font-style: italic;
        text-align: center;
        padding: 10px 0;
      }
      
      /* オートコンプリートの選択項目のスタイル拡張 */
      .autocomplete-suggestions li {
        position: relative;
      }
      
      .autocomplete-suggestions li:hover::after {
        content: attr(data-meaning);
        position: absolute;
        left: calc(100% + 10px);
        top: 0;
        background-color: #f0f8ff;
        border: 1px solid #4682b4;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10000;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // メモフィールドの監視設定
  function setupMemoMonitoring() {
    const memoInput = document.querySelector('#memo-ope');
    if (!memoInput) return null;
    
    // 既存の説明バブルを削除
    document.querySelectorAll('.memo-explanation-bubble').forEach(el => el.remove());
    
    // 新しい説明バブルの作成
    const bubble = document.createElement('div');
    bubble.className = 'memo-explanation-bubble';
    bubble.innerHTML = `
      <div class="memo-matches"></div>
      <div class="memo-no-content">メモを入力すると、その意味が表示されます。</div>
    `;
    
    // メモフィールドの親要素に位置関係を設定
    const parentElement = memoInput.parentElement;
    parentElement.style.position = 'relative';
    
    // バブルをDOMに追加
    parentElement.appendChild(bubble);
    
    return {
      input: memoInput,
      bubble: bubble,
      matchesContainer: bubble.querySelector('.memo-matches')
    };
  }

  // メモ内容からキーワードを検出して表示
  function updateMemoExplanation(elements) {
    const { input, bubble, matchesContainer } = elements;
    const memoText = input.value.trim();
    const noContentElement = bubble.querySelector('.memo-no-content');
    
    // キーワードマッチングと表示更新
    const matches = findMatches(memoText);
    matchesContainer.innerHTML = '';
    
    if (matches.length > 0) {
      matches.forEach(match => {
        const matchItem = document.createElement('div');
        matchItem.className = 'memo-match-item';
        
        // キーワードをタイトルとして表示
        const titleDiv = document.createElement('div');
        titleDiv.className = 'memo-match-title';
        titleDiv.textContent = match.keyword;
        matchItem.appendChild(titleDiv);
        
        // 意味を本文として表示
        const meaningDiv = document.createElement('div');
        meaningDiv.className = 'memo-match-meaning';
        meaningDiv.textContent = match.meaning;
        matchItem.appendChild(meaningDiv);
        
        matchesContainer.appendChild(matchItem);
      });
      
      // 吹き出しを表示し、「コンテントなし」メッセージを非表示
      if (noContentElement) noContentElement.style.display = 'none';
      bubble.classList.add('visible');
    } else if (memoText) {
      // テキストはあるがマッチしない場合
      const noMatches = document.createElement('div');
      noMatches.className = 'memo-no-matches';
      noMatches.textContent = '登録されているキーワードはありません';
      matchesContainer.appendChild(noMatches);
      
      // 吹き出しを表示し、「コンテントなし」メッセージを非表示
      if (noContentElement) noContentElement.style.display = 'none';
      bubble.classList.add('visible');
    } else {
      // テキストがない場合は吹き出しを非表示
      if (noContentElement) noContentElement.style.display = 'block';
      bubble.classList.remove('visible');
    }
  }

  // メモテキストからキーワードを検出
  function findMatches(text) {
    const matches = [];
    
    if (!text) return matches;
    
    Object.entries(MEMO_MEANINGS).forEach(([keyword, meaning]) => {
      if (text.includes(keyword)) {
        matches.push({ keyword, meaning });
      }
    });
    
    return matches;
  }

  // ドロップダウンのエンハンス
  function enhanceAutocomplete() {
    // オリジナルのサジェスト機能が使用する要素を探す
    const suggestionListContainer = document.querySelector('.autocomplete-suggestions');
    if (!suggestionListContainer) return;
    
    // MutationObserverでドロップダウンの変更を監視
    const observer = new MutationObserver((mutations) => {
      const listItems = suggestionListContainer.querySelectorAll('li');
      listItems.forEach(item => {
        // すでに処理済みならスキップ
        if (item.hasAttribute('data-meaning')) return;
        
        const text = item.textContent.trim();
        const meaning = MEMO_MEANINGS[text];
        
        if (meaning) {
          item.setAttribute('data-meaning', meaning);
        }
      });
    });
    
    observer.observe(suggestionListContainer, {
      childList: true,
      subtree: true
    });
  }

  // メモフィールドの監視とイベント設定
  function startMonitoring() {
    const elements = setupMemoMonitoring();
    if (!elements) {
      console.log('メモ入力フィールドが見つかりませんでした');
      return false;
    }
    
    const { input, bubble } = elements;
    
    // 入力イベントで説明を更新
    input.addEventListener('input', () => {
      updateMemoExplanation(elements);
    });
    
    // 選択イベントもキャッチする（ドロップダウンからの選択）
    input.addEventListener('change', () => {
      updateMemoExplanation(elements);
    });
    
    // キーボードイベントでもチェック（ファンクションキー対応）
    document.addEventListener('keydown', (e) => {
      // e.keyが存在し、文字列であることを確認
      if (e.key && typeof e.key === 'string' && e.key.startsWith('F')) {
        const keyNum = parseInt(e.key.slice(1));
        if (!isNaN(keyNum) && keyNum >= 5 && keyNum <= 10) {
          // ファンクションキーF5-F10が押された時、少し遅延して更新
          setTimeout(() => {
            updateMemoExplanation(elements);
          }, 50);
        }
      }
    });
    
    // フォーカスイベント
    input.addEventListener('focus', () => {
      if (input.value.trim()) {
        bubble.classList.add('visible');
      }
    });
    
    // フォーカスが外れた時
    input.addEventListener('blur', () => {
      // バブル上でのホバー状態を確認
      if (!bubble._userHovering) {
        setTimeout(() => {
          bubble.classList.remove('visible');
        }, 300);
      }
    });
    
    // マウスオーバーでも表示維持
    bubble.addEventListener('mouseenter', () => {
      bubble._userHovering = true;
    });
    
    bubble.addEventListener('mouseleave', () => {
      bubble._userHovering = false;
      if (!document.activeElement.isEqualNode(input)) {
        bubble.classList.remove('visible');
      }
    });
    
    // 初期状態の更新
    updateMemoExplanation(elements);
    
    // ドロップダウンの拡張
    setTimeout(enhanceAutocomplete, 500);
    
    return true;
  }

  // 既存のドロップダウン選択のハンドリング
  function setupDropdownSelectionHandling() {
    // 既存の自動補完機能にフックを追加
    const targetInput = document.querySelector('#memo-ope');
    if (!targetInput) return;

    // 既存のサジェストリストを取得
    const suggestionList = document.querySelector('.autocomplete-suggestions');
    if (!suggestionList) return;

    // クリックイベントをオーバーライド
    suggestionList.addEventListener('click', (e) => {
      if (e.target.tagName === 'LI') {
        // 少し遅延して説明を更新
        setTimeout(() => {
          const elements = {
            input: targetInput,
            bubble: document.querySelector('.memo-explanation-bubble'),
            matchesContainer: document.querySelector('.memo-explanation-bubble .memo-matches')
          };
          
          if (elements.bubble && elements.matchesContainer) {
            updateMemoExplanation(elements);
          }
        }, 50);
      }
    });
  }

  // メイン初期化処理
  function initialize() {
    console.log('メモ説明機能を初期化しています...');
    
    // スタイルの追加
    addStyles();
    
    // 監視の開始
    if (document.querySelector('#memo-ope')) {
      if (startMonitoring()) {
        console.log('メモ説明機能の初期化が完了しました');
        setupDropdownSelectionHandling();
      }
    } else {
      // DOM変更を監視して後からメモフィールドが追加される可能性に対応
      const observer = new MutationObserver((mutations) => {
        if (document.querySelector('#memo-ope')) {
          if (startMonitoring()) {
            console.log('メモ説明機能の初期化が完了しました');
            setupDropdownSelectionHandling();
            observer.disconnect();
          }
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // ページ読み込み状態に応じて初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    setTimeout(initialize, 0);
  }
})();