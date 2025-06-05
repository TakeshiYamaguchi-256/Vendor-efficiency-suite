
const MAX_ITERATIONS = 5;
const URL_B = "https://dock.streamedup.com/receipt2/step/registvendor?step=regist";

// 動作モード管理
let operationMode = false; // false = モード1（従来動作）, true = モード2（常にEscapeキーを押さない）

// 初期状態の読み込み
chrome.storage.local.get(['operationMode'], function(result) {
  operationMode = result.operationMode !== undefined ? result.operationMode : false;
  console.log('content.js: 動作モードを読み込み:', operationMode ? 'モード2' : 'モード1');
});

// メッセージリスナーを追加して設定の更新を受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateOperationMode") {
    operationMode = request.mode;
    console.log('content.js: 動作モードを更新:', operationMode ? 'モード2（常にスキップなし）' : 'モード1（従来動作）');
  } else if (request.action === "updateRightClickSetting") {
    isRightClickEnabled = request.enabled;
  }
});

// Escapeキー処理の判定関数
function shouldPressEscapeKey() {
  // モード2の場合は常にfalse（Escapeキーを押さない）
  if (operationMode) {
    console.log('モード2: Escapeキーを押しません（手動操作モード）');
    return false;
  }
  
  // モード1の場合は従来の判定ロジック
  const phoneInput = document.querySelector('#tel-search');
  const hasPhoneNumber = phoneInput && phoneInput.value && phoneInput.value.trim().length > 0;
  
  // テーブルと候補の存在確認
  const table = document.querySelector('.table-registvendor');
  const radioButtons = document.querySelectorAll('input[type="radio"][value]');
  const hasCandidates = table && radioButtons.length > 0;
  
  const shouldPress = hasPhoneNumber && hasCandidates;
  
  console.log('モード1: Escapeキー判定:', {
    hasPhoneNumber,
    hasCandidates,
    shouldPress: !shouldPress // shouldPressEscapeKeyはEscapeを押すかどうかなので、候補がある場合はfalse
  });
  
  return !shouldPress; // 電話番号と候補がある場合はEscapeキーを押さない
}
document.addEventListener('keydown', function(e) {

   if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          if (e.key === 'Escape') {


          // まず、"Single Doc" ドロップダウンを開く
            let singleDocLink = document.querySelector('li.dropdown.active > a.dropdown-toggle');
            if (singleDocLink) {
              singleDocLink.click();
              
              // ドロップダウンメニューが開くのを少し待つ
              setTimeout(() => {
                // "index" リンクを見つけてクリック
                let indexLink = document.querySelector('li.dropdown.active .dropdown-menu a[href="/receipt2/verification"]');
                if (indexLink) {
                  indexLink.click();
                } else {
                  console.log("'index' リンクが見つかりません");
                }
              }, 150); // 300ミリ秒待つ（必要に応じて調整してください）
            } else {
              console.log("'Single Doc' ドロップダウンが見つかりません");
            }

          }else if (e.key === 'ScrollLock') {
            e.preventDefault();
            const saveButton = document.querySelector('.btn-save');
            if (saveButton && !saveButton.disabled) {
                saveButton.click();
            }
          }else if (e.key === 'F1') {
              e.preventDefault();
            
              const escalationButton = document.querySelector('.btn-eslacation');
              if (escalationButton && !escalationButton.disabled) {
                  escalationButton.click();
              }
          }else if (e.key === 'F4') {
             e.preventDefault();
             focusPhoneNumberField();
             
          }else if (e.key === 'F5') {
             e.preventDefault();
             focusFirstTextInput();
          }else if (e.key === 'F11') {
            e.preventDefault();
            const  checkbox3  = document.querySelector('#not-clear'); 
            if (checkbox3) {
                checkbox3.click();
            }
          }else if (e.key === 'F12') {
            e.preventDefault();
            const  checkbox4  = document.querySelector('#cant-read'); 
            if (checkbox4) {
                checkbox4.click();
            }
          }
        }

      });

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





  // ページのロード完了時に2番目のテキスト入力エリアにフォーカスを移動
  if (document.readyState === 'complete') {
    focusFirstTextInput();
  } else {
    window.addEventListener('load', focusFirstTextInput);
  }

  function focusPhoneNumberField() {
    if (window.location.href === URL_B) {
       // 電話番号フィールドを特定のIDで取得
       const phoneField = document.querySelector('#tel-search');
       
       if (phoneField) {
         phoneField.focus();
         console.log('電話番号フィールドにフォーカスを移動しました');
       } else {
         console.log('電話番号フィールドが見つかりません');
       }
    }
  }


// 1番目のテキスト入力エリアにフォーカスを移す関数
function focusFirstTextInput() {
  if (window.location.href === URL_B) {
     // すべてのテキスト入力エリアを取得
     const textInputs = document.querySelectorAll('input[type="text"], textarea');
     
     // 1番目のテキスト入力エリアが存在する場合、フォーカスを移動
     if (textInputs.length >= 1) {
       textInputs[0].focus();
       console.log('1番目のテキスト入力エリアにフォーカスを移動しました');
     } else {
       console.log('1番目のテキスト入力エリアが見つかりません');
     }
  }
}


// 2番目のテキスト入力エリアにフォーカスを移す関数
function focusSecondTextInput() {
  if (window.location.href === URL_B) {
     // すべてのテキスト入力エリアを取得
     const textInputs = document.querySelectorAll('input[type="text"], textarea');
     
     // 2番目のテキスト入力エリアが存在する場合、フォーカスを移動
     if (textInputs.length >= 2) {
       textInputs[1].focus();
       console.log('2番目のテキスト入力エリアにフォーカスを移動しました');
     } else {
       console.log('2番目のテキスト入力エリアが見つかりません');
     }
  }
}





// filterElementSelector と isFilterEnabled 変数を宣言
const filterElementSelector = '.kvs-company-trafic';
// 列のインデックスを修正 - 実際のテーブル構造に合わせて調整
// 業種情報がある適切な列のインデックスを指定（0から始まる）
const columnIndex = 4; 
let isFilterEnabled = true; // デフォルトでフィルターは有効

function getFilterValue() {
  const filterElement = document.querySelector(filterElementSelector);
  if (filterElement) {
    const labelElement = filterElement.querySelector('label');
    if (labelElement) {
      // ラベルのテキストを取得し、特殊アイコン（⚙️と✅）を削除
      const rawText = labelElement.textContent.trim();
      const filterValue = rawText.replace(/[⚙️✅]/g, '').trim();
      
      console.log(`フィルター値: "${filterValue}" (元の値: "${rawText}")`);
      return filterValue;
    }
  }
  return null;
}

function disableRows(filterValue) {
  if (!filterValue) return; // フィルター値がない場合は何もしない

  // デバッグログ - 処理開始
  console.log(`disableRows実行: フィルター値="${filterValue}", フィルター有効=${isFilterEnabled}`);

  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    let skipNextRow = false;

    rows.forEach((row, index) => {
      // ヘッダー行をスキップ
      if (index === 0 && row.querySelector('th')) return;

      // 前の行の処理でスキップするフラグが立っている場合、この行をスキップ
      if (skipNextRow) {
        skipNextRow = false;
        return;
      }

      const cells = row.querySelectorAll('td');
      if (cells.length > columnIndex) {
        const cellValue = cells[columnIndex].textContent.trim();
        
        // デバッグログ - セルの値を確認
        console.log(`行 ${index}: セル値="${cellValue}", フィルター値との一致=${cellValue.includes(filterValue)}`);
        
        // フィルターが有効の場合は、該当する業種のみ有効（それ以外はグレーアウト）
        // フィルターが無効の場合は、すべての行を有効化
        const shouldDisable = isFilterEnabled ? !cellValue.includes(filterValue) : false;

        // 現在の行と次の行（存在する場合）にスタイルを適用
        applyStyleToRow(row, shouldDisable);
        
        // rowspan="2"を持つセルがある場合、次の行も同じスタイルを適用
        const hasRowSpan = Array.from(cells).some(cell => cell.rowSpan === 2);
        if (hasRowSpan && index + 1 < rows.length) {
          applyStyleToRow(rows[index + 1], shouldDisable);
          skipNextRow = true;
        }
      }
    });
  });
}

// フィルターの有効/無効を切り替えて再適用する関数
function toggleFilter() {
  isFilterEnabled = !isFilterEnabled;
  
  // フィルター値を取得
  const filterValue = getFilterValue();
  if (!filterValue) return;
  
  // フィルターの状態に基づいて行を更新
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    let skipNextRow = false;
    
    rows.forEach((row, index) => {
      if (index === 0 && row.querySelector('th')) return; // ヘッダー行はスキップ
      
      if (skipNextRow) {
        skipNextRow = false;
        return;
      }
      
      const cells = row.querySelectorAll('td');
      if (cells.length > columnIndex) {
        const cellValue = cells[columnIndex].textContent.trim();
        // フィルターが有効なら該当しない業種をグレーアウト、無効ならすべて表示
        const shouldDisable = isFilterEnabled ? !cellValue.includes(filterValue) : false;
        
        applyStyleToRow(row, shouldDisable);
        
        // rowspan="2"を持つセルがある場合、次の行も同じスタイルを適用
        const hasRowSpan = Array.from(cells).some(cell => cell.rowSpan === 2);
        if (hasRowSpan && index + 1 < rows.length) {
          applyStyleToRow(rows[index + 1], shouldDisable);
          skipNextRow = true;
        }
      }
    });
  });
  
  // フィルターの状態を通知
  showFilterStatusNotification(isFilterEnabled);
}

// フィルターの状態を通知する関数
function showFilterStatusNotification(isEnabled) {
  const notification = document.createElement('div');
  notification.textContent = isEnabled 
    ? '業種フィルターが有効になりました' 
    : '業種フィルターが無効になりました';
  
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = isEnabled ? '#4CAF50' : '#FF9800';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '10000';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  notification.style.fontWeight = 'bold';
  
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function applyStyleToRow(row, shouldDisable) {
  const cells = row.querySelectorAll('td');
  if (shouldDisable) {
    row.style.opacity = '0.5';
    row.style.pointerEvents = 'none';
    row.style.backgroundColor = '#e6f2ff';
    cells.forEach(cell => {
      cell.style.color = '#999';
      applyStyleToChildren(cell, '#999');
    });
  } else {
    row.style.opacity = '';
    row.style.pointerEvents = '';
    row.style.backgroundColor = '#fffde7';
    cells.forEach(cell => {
      cell.style.color = '';
      applyStyleToChildren(cell, '');
    });
  }
}

function applyStyleToChildren(element, color) {
  const children = element.children;
  for (let child of children) {
    child.style.color = color;
    applyStyleToChildren(child, color);
  }
}

function init() {
  console.log('業種フィルター初期化開始');
  
  // 業種フィルター要素を探す
  const filterElement = document.querySelector(filterElementSelector);
  if (!filterElement) {
    console.log('業種フィルター要素が見つかりません');
    return;
  }
  
  console.log('業種フィルター要素を見つけました:', filterElement);
  
  // 業種フィルター要素をクリック可能にする
  makeFilterElementClickable(filterElement);
  
  // 初期フィルター適用
  const filterValue = getFilterValue();
  if (filterValue) {
    console.log(`フィルター値="${filterValue}"でフィルターを適用します (有効=${isFilterEnabled})`);
    disableRows(filterValue);
  } else {
    console.log('フィルター値が見つからないか、フィルターが無効です');
  }
}

// 業種フィルター要素をクリック可能にする関数
function makeFilterElementClickable(filterElement) {
  // 既存のクリックイベントを解除（二重登録を防ぐ）
  filterElement.removeEventListener('click', toggleFilter);
  
  // カーソルをポインターに変更して、クリック可能であることをビジュアル的に示す
  filterElement.style.cursor = 'pointer';
  
  // クリック可能なことを示すホバー効果を追加
  filterElement.addEventListener('mouseover', () => {
    filterElement.style.backgroundColor = '#f0f0f0';
  });
  
  filterElement.addEventListener('mouseout', () => {
    filterElement.style.backgroundColor = '';
  });
  
  // クリック時にフィルターのトグルを実行
  filterElement.addEventListener('click', toggleFilter);
  
  // クリック可能なことを示すツールチップを追加
  filterElement.title = 'クリックでフィルターのオン/オフを切り替え';
  
  // 視覚的な手がかりとして小さなアイコンやテキストを追加
  const toggleIndicator = document.createElement('span');
  toggleIndicator.textContent = '⚙️';
  toggleIndicator.style.marginLeft = '5px';
  toggleIndicator.style.fontSize = '12px';
  
  // すでに追加されていなければ追加
  if (!filterElement.querySelector('.toggle-indicator')) {
    toggleIndicator.classList.add('toggle-indicator');
    
    // ラベル要素の後に追加
    const labelElement = filterElement.querySelector('label');
    if (labelElement) {
      labelElement.appendChild(toggleIndicator);
    } else {
      filterElement.appendChild(toggleIndicator);
    }
  }
}

// ページ読み込み完了時に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 動的な変更を監視（オプション）
const observer = new MutationObserver(() => {
  // 業種フィルター要素を探して、クリック可能にする
  const filterElement = document.querySelector(filterElementSelector);
  if (filterElement) {
    makeFilterElementClickable(filterElement);
  }
  
  // フィルターの適用（現在の設定に基づく）
  const filterValue = getFilterValue();
  if (filterValue) {
    disableRows(filterValue);
  }
});
observer.observe(document.body, { childList: true, subtree: true });


//テキストエリアの背景色を設定/////////////////////////////////////////
function updateFieldStyle(field) {
  if (field.disabled) {
    field.classList.remove('highlight-value', 'highlight-focus');
  } else if (field.value.trim() !== '') {
    field.classList.add('highlight-value');
  } else {
    field.classList.remove('highlight-value');
  }
}

function handleFocus(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    e.target.classList.add('highlight-focus');
    updateFieldStyle(e.target);
  }
}

function handleBlur(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    e.target.classList.remove('highlight-focus');
    updateFieldStyle(e.target);
  }
}

function handleInput(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    updateFieldStyle(e.target);
  }
}

function setupField(field) {
  field.addEventListener('focus', handleFocus);
  field.addEventListener('blur', handleBlur);
  field.addEventListener('input', handleInput);
  updateFieldStyle(field);
}

// 既存のフィールドにイベントリスナーを設定
document.querySelectorAll('input, textarea').forEach(setupField);

// 動的に追加されるフィールドとモーダルを監視
const observeDocument = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 新しく追加された要素がモーダルまたはポップアップの可能性がある場合
          if (node.classList.contains('modal') || node.classList.contains('popup') || node.id.includes('modal') || node.id.includes('popup')) {
            setTimeout(() => {
              node.querySelectorAll('input, textarea').forEach(setupField);
            }, 0);
          }
          // 入力フィールドの場合
          if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
            setupField(node);
          } else {
            node.querySelectorAll('input, textarea').forEach(setupField);
          }
        }
      });
    }
  });
});

observeDocument.observe(document.body, {
  childList: true,
  subtree: true
});

// disabled 属性の変更を監視
const observeDisabled = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
      updateFieldStyle(mutation.target);
    }
  });
});

document.querySelectorAll('input, textarea').forEach(field => {
  observeDisabled.observe(field, { attributes: true });
});

// モーダルやポップアップの表示を検出し、その中のフィールドを初期化
function checkForModalOpen() {
  const possibleModals = document.querySelectorAll('.modal, .popup, [id*="modal"], [id*="popup"]');
  possibleModals.forEach(modal => {
    if (modal.style.display === 'block' || modal.style.visibility === 'visible' || window.getComputedStyle(modal).display !== 'none') {
      modal.querySelectorAll('input, textarea').forEach(setupField);
    }
  });
}

// 定期的にモーダルの表示をチェック
setInterval(checkForModalOpen, 1000);

// ページロード時にも実行
window.addEventListener('load', checkForModalOpen);

/////////////////////////////////データをスクロール可能にする///////////////
function makeTableScrollable() {
  const tables = document.querySelectorAll('.table-registvendor');
  tables.forEach(table => {
    if (!table.parentElement.classList.contains('table-container')) {
      const container = document.createElement('div');
      container.classList.add('table-container');
      table.parentNode.insertBefore(container, table);
      container.appendChild(table);
    }
  });
}

// ページ読み込み後に実行
document.addEventListener('DOMContentLoaded', makeTableScrollable);

// 動的に追加される要素に対応するため、MutationObserverを使用
const observer2 = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length) {
      makeTableScrollable();
    }
  });
});

observer2.observe(document.body, { childList: true, subtree: true });




/*
// 全角英数字記号のパターン
const fullWidthPattern = /[Ａ-Ｚａ-ｚ０-９！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/;
// 半角カタカナのパターン
const halfWidthKanaPattern = /[\uff61-\uff9f]/;
// チェック対象の列インデックス
const TARGET_COLUMN_INDEX = 3;

// 処理中フラグ
let isProcessing = false;
// 直前の処理時刻
let lastProcessTime = 0;
const PROCESS_INTERVAL = 500; // 処理間隔（ミリ秒）

function disableAndHighlightRow(row) {
    if (!row?.style) return;
    row.style.pointerEvents = 'none';
    row.style.backgroundColor = '#fff0f0';
}

function checkAndStyleInvalidChars() {
    // 処理中の場合はスキップ
    if (isProcessing) return;
    
    // 前回の処理から十分な時間が経過していない場合はスキップ
    const currentTime = Date.now();
    if (currentTime - lastProcessTime < PROCESS_INTERVAL) return;
    
    isProcessing = true;
    lastProcessTime = currentTime;

    try {
        const tables = document.querySelectorAll('.table-registvendor');
        if (!tables.length) return;

        tables.forEach(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            let skipNextRow = false;
            
            rows.forEach((row, index) => {
                if (skipNextRow) {
                    skipNextRow = false;
                    return;
                }

                if (index === 0 && row.querySelector('th')) return;

                const cells = row.querySelectorAll('td');
                if (cells.length <= TARGET_COLUMN_INDEX) return;

                const targetCell = cells[TARGET_COLUMN_INDEX];
                const text = targetCell.textContent;

                // 既に処理済みの場合はスキップ
                if (targetCell.dataset.processed === 'true') return;

                const hasFullWidth = fullWidthPattern.test(text);
                const hasHalfKana = halfWidthKanaPattern.test(text);

                if (hasFullWidth || hasHalfKana) {
                    let newHTML = text;
                    if (hasFullWidth) {
                        newHTML = newHTML.replace(new RegExp(fullWidthPattern, 'g'), 
                            match => `<span style="color: #ff0000; font-weight: bold;">${match}</span>`);
                    }
                    if (hasHalfKana) {
                        newHTML = newHTML.replace(new RegExp(halfWidthKanaPattern, 'g'),
                            match => `<span style="color: #ff0000; font-weight: bold;">${match}</span>`);
                    }

                    targetCell.innerHTML = newHTML;
                    targetCell.dataset.processed = 'true';
                    disableAndHighlightRow(row);

                    const hasRowSpan = Array.from(cells).some(cell => cell.rowSpan === 2);
                    if (hasRowSpan && index + 1 < rows.length) {
                        disableAndHighlightRow(rows[index + 1]);
                        skipNextRow = true;
                    }
                }
            });
        });
    } finally {
        isProcessing = false;
    }
}

// 動的コンテンツの処理を最適化したMutationObserver
const charObserver = new MutationObserver((mutations) => {
    // addedNodesがある変更のみを処理
    const hasNewNodes = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => 
            node.nodeType === 1 && // 要素ノードのみ
            !node.classList?.contains('processed') // 未処理のノードのみ
        )
    );

    if (hasNewNodes) {
        requestAnimationFrame(() => {
            checkAndStyleInvalidChars();
        });
    }
});

// テーブル要素の監視を開始
document.querySelectorAll('.table-registvendor').forEach(table => {
    charObserver.observe(table, {
        childList: true,
        subtree: true
    });
});

// 初期表示時の処理
document.addEventListener('DOMContentLoaded', checkAndStyleInvalidChars);
*/






// NGワードチェック機能のための変数
const TARGET_COLUMN_INDEX = 3;
let isNgProcessing = false;
let lastNgProcessTime = 0;
const NG_PROCESS_INTERVAL = 500;

// NGワードリストを直接コード内で定義
const ngWordsList = [
  "株式会社",
  "有限会社",
  "合同会社",
  "合資会社",
  "合名会社",
  "医療法人",
  "医療法人社団",
  "医療法人財団",
  "社会医療法人",
  "宗教法人",
  "学校法人",
  "社会福祉法人",
  "更生保護法人",
  "相互会社",
  "特定非営利活動法人",
  "独立行政法人",
  "地方独立行政法人",
  "弁護士法人",
  "有限責任中間法人",
  "無限責任中間法人",
  "行政書士法人",
  "司法書士法人",
  "税理士法人",
  "国立大学法人",
  "公立大学法人",
  "農事組合法人",
  "管理組合法人",
  "社会保険労務士法人",
  "一般社団法人",
  "公益社団法人",
  "一般財団法人",
  "公益財団法人",
  "非営利法人",
  "(株)",
  "(有)",
  "支店"
];

function disableAndHighlightNgRow(row) {
    if (!row?.style) return;
    
    row.style.pointerEvents = 'none';
    row.style.backgroundColor = '#ffebee';
    row.style.position = 'relative';
    
    const cells = row.querySelectorAll('td');
    cells.forEach(cell => {
        cell.style.color = '#666666';
        cell.style.fontSize = 'inherit';
        
        const spans = cell.querySelectorAll('span');
        spans.forEach(span => {
            span.style.fontSize = 'inherit';
        });
    });
}

function highlightNgWord(text, ngWord) {
    const regex = new RegExp(`(${ngWord})`, 'g');
    return text.replace(regex, '<span class="ng-word">$1</span>');
}

function checkAndStyleNgWords() {
    if (isNgProcessing || ngWordsList.length === 0) return;
    
    const currentTime = Date.now();
    if (currentTime - lastNgProcessTime < NG_PROCESS_INTERVAL) return;
    
    isNgProcessing = true;
    lastNgProcessTime = currentTime;

    try {
        const tables = document.querySelectorAll('.table-registvendor');
        if (!tables.length) return;

        tables.forEach(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            let skipNextRow = false;
            
            rows.forEach((row, index) => {
                if (skipNextRow) {
                    skipNextRow = false;
                    return;
                }

                if (index === 0 && row.querySelector('th')) return;

                const cells = row.querySelectorAll('td');
                if (cells.length <= TARGET_COLUMN_INDEX) return;

                const targetCell = cells[TARGET_COLUMN_INDEX];
                const text = targetCell.textContent;

                if (targetCell.dataset.ngProcessed === 'true') return;

                let hasNgWord = false;
                let processedText = text;

                for (const ngWord of ngWordsList) {
                    if (text.includes(ngWord)) {
                        hasNgWord = true;
                        processedText = highlightNgWord(processedText, ngWord);
                    }
                }

                if (hasNgWord) {
                    targetCell.innerHTML = processedText;
                    targetCell.dataset.ngProcessed = 'true';
                    disableAndHighlightNgRow(row);

                    const hasRowSpan = Array.from(cells).some(cell => cell.rowSpan === 2);
                    if (hasRowSpan && index + 1 < rows.length) {
                        disableAndHighlightNgRow(rows[index + 1]);
                        skipNextRow = true;
                    }
                }
            });
        });
    } finally {
        isNgProcessing = false;
    }
}

// NGワード用スタイルの追加
const ngStyle = document.createElement('style');
ngStyle.textContent = `
    .ng-word {
        color: #d32f2f;
        font-weight: bold;
        font-size: inherit;
        background-color: #ffcdd2;
        padding: 0 2px;
        border-radius: 2px;
    }
`;
document.head.appendChild(ngStyle);

// NGワードチェックの監視設定
const ngWordObserver = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => 
            node.nodeType === 1 && 
            !node.classList?.contains('ng-processed')
        )
    );

    if (hasNewNodes) {
        requestAnimationFrame(() => {
            checkAndStyleNgWords();
        });
    }
});

// テーブルの監視を開始
document.querySelectorAll('.table-registvendor').forEach(table => {
    ngWordObserver.observe(table, {
        childList: true,
        subtree: true
    });
});

// DOMContentLoaded時の初期チェック
document.addEventListener('DOMContentLoaded', checkAndStyleNgWords);



// 右クリック機能の状態を保持する変数
let isRightClickEnabled = true;

// 初期状態を読み込む
chrome.storage.local.get(['rightClickEnabled'], function(result) {
  isRightClickEnabled = result.rightClickEnabled !== undefined ? result.rightClickEnabled : true;
});

// メッセージリスナーを追加して設定の更新を受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateRightClickSetting") {
    isRightClickEnabled = request.enabled;
  }
});

// URL Bでのみ右クリックイベントを処理
if (window.location.href === URL_B) {
  document.addEventListener('mousedown', function(event) {
    // 右クリックの場合（button: 2）かつ機能が有効な場合のみ処理
    if (event.button === 2 && isRightClickEnabled) {
      event.preventDefault();
      
      // Scroll Lockキーのkeydownイベントを作成
      const scrollLockEvent = new KeyboardEvent('keydown', {
        key: 'ScrollLock',
        code: 'ScrollLock',
        which: 145,
        keyCode: 145,
        bubbles: true,
        cancelable: true
      });

      // イベントをドキュメントに対してディスパッチ
      document.dispatchEvent(scrollLockEvent);
      
      console.log('URL B: 右クリックが検出され、Scroll Lock keydownイベントが発生しました');
    }
  });

  // contextmenuイベントの処理
  document.addEventListener('contextmenu', function(event) {
    // 機能が有効な場合のみ preventDefault を呼び出す
    if (isRightClickEnabled) {
      event.preventDefault();
    }
  });
}





// フィードバック表示用の関数
function showFeedback(isRunning) {
  const feedback = document.createElement('div');
  feedback.textContent = isRunning ? "処理を開始します" : "処理を停止します";
  feedback.style.position = 'fixed';
  feedback.style.left = '50%';
  feedback.style.top = '20px';
  feedback.style.transform = 'translateX(-50%)';
  feedback.style.padding = '10px 20px';
  feedback.style.backgroundColor = isRunning ? '#4CAF50' : '#f44336';
  feedback.style.color = 'white';
  feedback.style.borderRadius = '4px';
  feedback.style.zIndex = '10000';
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 2000);
}

// エラー時のフィードバック表示
function showErrorFeedback() {
  const feedback = document.createElement('div');
  feedback.textContent = "エラーが発生しました";
  feedback.style.position = 'fixed';
  feedback.style.left = '50%';
  feedback.style.top = '20px';
  feedback.style.transform = 'translateX(-50%)';
  feedback.style.padding = '10px 20px';
  feedback.style.backgroundColor = '#ff9800';
  feedback.style.color = 'white';
  feedback.style.borderRadius = '4px';
  feedback.style.zIndex = '10000';
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
  }, 2000);
}





// content.js////////////////////////////////////
let isImageDisplayed = false;
let container = null;
let isDragging = false;
let startX, startY, initialLeft, initialTop;
let currentScale = 1;

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
  
  container = document.createElement('div');
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

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('images/display_image.png');
  Object.assign(img.style, {
    width: '100%',
    height: 'auto',
    opacity: '0.8',
    transition: 'transform 0.1s ease-out'
  });

  container.appendChild(img);
  document.body.appendChild(container);

  // 初期位置を設定
  const rect = container.getBoundingClientRect();
  container.style.top = rect.top + 'px';
  container.style.left = rect.left + 'px';
  container.style.transform = 'none';

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

    img.style.transform = `scale(${currentScale})`;

    // マウス位置を中心に拡大縮小するための調整
    const newLeft = rect.left + mouseX - (mouseX * currentScale / (currentScale - 0.1));
    const newTop = rect.top + mouseY - (mouseY * currentScale / (currentScale - 0.1));

    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
  }

  container.addEventListener('mousedown', startDragging);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDragging);
  container.addEventListener('dblclick', removeImage);
  container.addEventListener('wheel', zoom);
}

document.addEventListener('keydown', (event) => {
  // 現在のURLを確認
  if (window.location.href === URL_B) {
      if (event.key === 'Pause') {
          if (!isImageDisplayed) {
              chrome.runtime.sendMessage({action: "showImage"});
          } else {
              removeImage();
          }
      } else if (event.key === 'Escape') {
          removeImage();
      }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displayImage" && window.location.href === URL_B) {
      createAndDisplayImage();
  }
});




////-------------------------------------------------------------------------
const PhoneBackupManager = {
  getVendorFullDetails() {
    try {
      // 電話番号の取得
      const phoneInput = document.querySelector('input#tel-search');
      const phoneNumber = phoneInput?.value;
      
      // 選択された業者の情報取得
      const selectedRadio = document.querySelector('input[name="select_vendor_id"]:checked');
      if (!selectedRadio) {
        return {
          phoneNumber: null,
          vendorId: null,
          vendorName: null,
          vendorPhonetic: null,
          vendorIndustry: null
        };
      }

      const vendorRow = selectedRadio.closest('tr');
      if (!vendorRow) return null;

      // 業者IDの取得（最初のtr内のdata-label-id要素から）
      const vendorId = vendorRow.querySelector('label[data-label-id]')?.getAttribute('value');
      
      // 業者名と業種の取得（最初のtr内）
      const vendorName = vendorRow.querySelector('label[data-label="name"]')?.textContent;
      const vendorIndustry = vendorRow.querySelector('label[data-label="industry"]')?.textContent;

      // フリガナの取得（次のtr内のdata-label="phonetic"要素から）
      const nextRow = vendorRow.nextElementSibling;
      const vendorPhonetic = nextRow?.querySelector('label[data-label="phonetic"]')?.textContent;

      console.log('取得したデータ:', {
        phoneNumber,
        vendorId,
        vendorName,
        vendorPhonetic,
        vendorIndustry
      });

      return {
        phoneNumber,
        vendorId,
        vendorName,
        vendorPhonetic,
        vendorIndustry
      };
    } catch (error) {
      console.error('データ取得エラー:', error);
      return {
        phoneNumber: null,
        vendorId: null,
        vendorName: null,
        vendorPhonetic: null,
        vendorIndustry: null
      };
    }
  },

  async savePhoneData() {
    try {
      const {
        phoneNumber,
        vendorId,
        vendorName,
        vendorPhonetic,
        vendorIndustry
      } = this.getVendorFullDetails();

      // 必須項目のチェック
      if (!phoneNumber || !vendorName) {
        console.log('保存条件を満たしていません:', {
          hasPhoneNumber: !!phoneNumber,
          hasSelectedVendor: !!vendorName
        });
        this.showNotification('必要なデータが揃っていません', 'error');
        return;
      }

      // 新しいエントリを作成
      const newEntry = {
        phoneNumber,
        vendorId: vendorId || '',
        vendorName,
        vendorPhonetic: vendorPhonetic || '',  // フリガナがない場合は空文字
        vendorIndustry: vendorIndustry || '', // 業種がない場合は空文字
        timestamp: new Date().toISOString()
      };

      // Chrome Storageに保存
      const response = await chrome.runtime.sendMessage({
        action: 'appendVendorEntry',
        entry: newEntry
      });

      if (response.success) {
        console.log('✅ データを保存しました:', newEntry);
        this.showNotification('データを保存しました');
      } else {
        throw new Error(response.error || '保存に失敗しました');
      }

    } catch (error) {
      console.error('保存処理エラー:', error);
      this.showNotification('保存に失敗しました', 'error');
    }
  },

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: type === 'success' ? '#4CAF50' : '#f44336',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '4px',
      zIndex: '10000',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    });

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
};

// Saveボタンクリック時の監視
document.addEventListener('click', async function(event) {
  if (event.target.matches('.btn-save')) {
    console.log('Saveボタンクリックを検知');
    try {
      await PhoneBackupManager.savePhoneData();
    } catch (error) {
      console.error('ボタンクリックハンドラエラー:', error);
    }
  }
});

//---------------------------------------------------------------------------

// 電話番号入力と業者選択の自動化機能（最適化版）
// 超高速版 AutoVendorSelector の完全実装
// メモリ使用量を増やして処理速度を最大化しつつ、手動入力でも確実に動作
const UltraFastVendorSelector = {
  // データストレージ
  vendorData: null,
  phoneIndex: {},
  buttonCache: {},
  initialized: false,
  lastProcessedPhone: null,
  preloadedSelectors: [],
  domObservers: [],
  CACHE_DURATION: 120000, // 2分間キャッシュ有効
  lastCacheUpdate: 0,
  
  // 初期化処理
  async init() {
    console.time('初期化時間');
    console.log('UltraFastVendorSelector: 初期化開始');
    
    try {
      // 以前のオブザーバーをクリーンアップ
      this.cleanupObservers();
      
      // データを事前ロード（非同期処理を開始）
      this.preloadData();
      
      // 電話番号フィールドの監視を設定
      this.setupPhoneFieldWatcher();
      
      // 検索ボタンの監視を設定
      this.setupSearchButtonListener();
      
      // URLから電話番号をチェック
      this.checkUrlForPhoneNumber();
      
      // DOM変更を監視
      this.observeDOMChanges();
      
      // グローバルイベントハンドラ（キャプチャフェーズ）
      this.setupGlobalEventHandlers();
      
      this.initialized = true;
      console.timeEnd('初期化時間');
     /* 
      // 定期的に実行（見落としを防止）
      this.setupPeriodicCheck();
    */
      } catch (error) {
      console.error('初期化エラー:', error);
    }
      
  },
  
  // オブザーバーのクリーンアップ
  cleanupObservers() {
    // 既存のオブザーバー解除
    this.domObservers.forEach(observer => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    });
    this.domObservers = [];
    
    // インターバルクリア
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  },
  
  // データの事前ロード
  async preloadData() {
    try {
      // キャッシュが有効な場合はスキップ
      const now = Date.now();
      if (this.vendorData && (now - this.lastCacheUpdate < this.CACHE_DURATION)) {
        return this.vendorData;
      }
      
      console.log('データをプリロード中...');
      
      // ストレージからデータをロード
      const result = await chrome.storage.local.get(['vendorEntries']);
      const entries = result.vendorEntries || [];
      
      // インデックスを構築
      this.phoneIndex = {}; // 電話番号 → エントリー配列
      this.vendorIdMap = {}; // vendorId → エントリー
      
      // 正規化とインデックス構築を一度に行う
      entries.forEach(entry => {
        if (!entry) return;
        
        // データ正規化
        const normalizedEntry = {
          ...entry,
          phoneNumber: (entry.phoneNumber || '').replace(/[^\d]/g, ''),
          vendorId: String(entry.vendorId || '')
        };
        
        // 電話番号インデックス
        if (normalizedEntry.phoneNumber) {
          if (!this.phoneIndex[normalizedEntry.phoneNumber]) {
            this.phoneIndex[normalizedEntry.phoneNumber] = [];
          }
          this.phoneIndex[normalizedEntry.phoneNumber].push(normalizedEntry);
        }
        
        // ID インデックス
        if (normalizedEntry.vendorId) {
          this.vendorIdMap[normalizedEntry.vendorId] = normalizedEntry;
        }
      });
      
      // 各電話番号に対する最新エントリーを事前計算
      this.latestEntryByPhone = {};
      Object.keys(this.phoneIndex).forEach(phone => {
        const entries = this.phoneIndex[phone];
        if (entries && entries.length > 0) {
          // 日付でソートして最新のものを取得
          this.latestEntryByPhone[phone] = entries.reduce((latest, current) => {
            if (!latest) return current;
            const latestDate = new Date(latest.timestamp || 0);
            const currentDate = new Date(current.timestamp || 0);
            return currentDate > latestDate ? current : latest;
          }, null);
        }
      });
      
      this.vendorData = entries;
      this.lastCacheUpdate = now;
      console.log(`${entries.length}件のデータをプリロード完了`);
      
      // 選択子を事前コンパイル
      this.preloadSelectors = [
        'input#tel-search',
        'input[type="radio"][value]',
        '.table-registvendor',
        'form#tel-search-form'
      ].map(selector => ({
        selector,
        compiled: selector
      }));
      
      return entries;
    } catch (error) {
      console.error('データプリロードエラー:', error);
      return [];
    }
  },
  
  // 電話番号フィールド監視
  setupPhoneFieldWatcher() {
    // フィールドの直接検索
    const phoneField = document.querySelector('input#tel-search');
    if (phoneField) {
      console.log('電話番号フィールドを検出:', phoneField);
      
      // 既存のリスナーを削除
      if (this._inputHandler) phoneField.removeEventListener('input', this._inputHandler);
      if (this._keydownHandler) phoneField.removeEventListener('keydown', this._keydownHandler);
      if (this._blurHandler) phoneField.removeEventListener('blur', this._blurHandler);
      if (this._focusoutHandler) phoneField.removeEventListener('focusout', this._focusoutHandler);
      
      // 入力イベント - デバウンスなしですぐに反応
      this._inputHandler = (e) => {
        console.log('INPUT イベント:', e.target.value);
        if (e.target.value && e.target.value.length >= 8) {
          this.processPhoneNumber(e.target.value);
        }
      };
      
      // キーダウンイベント - Enterキー対応
      this._keydownHandler = (e) => {
        if (e.key === 'Enter') {
          console.log('ENTER キー:', e.target.value);
          if (e.target.value && e.target.value.length >= 8) {
            this.processPhoneNumber(e.target.value, true);
          }
        }
      };
      
      // フォーカスを失ったとき - 入力完了とみなす
      this._blurHandler = (e) => {
        console.log('BLUR イベント:', e.target.value);
        if (e.target.value && e.target.value.length >= 8) {
          // 少し遅延させて検索結果が表示される時間を確保
          setTimeout(() => {
            this.processPhoneNumber(e.target.value);
          }, 300);
        }
      };
      
      // フォーカスアウトイベント - 冗長性のため追加
      this._focusoutHandler = (e) => {
        console.log('FOCUSOUT イベント:', e.target.value);
        if (e.target.value && e.target.value.length >= 8) {
          // 少し遅延させて検索結果が表示される時間を確保
          setTimeout(() => {
            this.processPhoneNumber(e.target.value);
          }, 300);
        }
      };
      
      // 複数のイベントで捕捉
      phoneField.addEventListener('input', this._inputHandler);
      phoneField.addEventListener('keydown', this._keydownHandler);
      phoneField.addEventListener('blur', this._blurHandler);
      phoneField.addEventListener('focusout', this._focusoutHandler);
      
      // 初期値がある場合は処理
      if (phoneField.value && phoneField.value.length >= 8) {
        console.log('初期値を検出:', phoneField.value);
        this.processPhoneNumber(phoneField.value);
      }
    } else {
      console.log('電話番号フィールドが見つかりません - 再試行します');
      // フィールドが見つからない場合、少し遅延して再試行
      setTimeout(() => this.setupPhoneFieldWatcher(), 500);
    }
    
    // フォーム送信の監視強化
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      // 既存のリスナーを削除して再設定
      if (this._submitHandler) form.removeEventListener('submit', this._submitHandler);
      
      this._submitHandler = (e) => {
        const phoneInput = form.querySelector('#tel-search');
        if (phoneInput && phoneInput.value) {
          console.log('フォーム送信:', phoneInput.value);
          this.lastProcessedPhone = phoneInput.value;
          
          // 少し遅延させて処理（検索結果表示を待つ）
          setTimeout(() => {
            this.executeVendorSelection(phoneInput.value);
          }, 500);
        }
      };
      
      form.addEventListener('submit', this._submitHandler);
    });
  },
  
  // フォーム検索ボタンのイベント監視も追加
  setupSearchButtonListener() {
    // 検索ボタンを探す - 複数のセレクタで対応
    const searchButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], .btn-search');
    
    searchButtons.forEach(button => {
      if (this._buttonClickHandler) button.removeEventListener('click', this._buttonClickHandler);
      
      this._buttonClickHandler = (e) => {
        const form = button.closest('form');
        if (!form) return;
        
        const phoneInput = form.querySelector('#tel-search');
        if (phoneInput && phoneInput.value) {
          console.log('検索ボタンクリック:', phoneInput.value);
          
          // 少し遅延させて検索結果が表示される時間を確保
          setTimeout(() => {
            this.processPhoneNumber(phoneInput.value);
          }, 500);
        }
      };
      
      button.addEventListener('click', this._buttonClickHandler);
    });
  },
  
  // URLのクエリパラメータからの電話番号取得も追加
  checkUrlForPhoneNumber() {
    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      const phoneParam = params.get('tel') || params.get('phone') || params.get('phoneNumber');
      
      if (phoneParam && phoneParam.length >= 8) {
        console.log('URLから電話番号を検出:', phoneParam);
        // 少し遅延させてDOM構築を待つ
        setTimeout(() => {
          this.processPhoneNumber(phoneParam);
        }, 500);
      }
    } catch (e) {
      console.error('URL解析エラー:', e);
    }
  },
  
  // 定期的なチェック
  setupPeriodicCheck() {
    // クリアして再設定
    /*if (this._checkInterval) clearInterval(this._checkInterval);
    
    this._checkInterval = setInterval(() => {
      const phoneField = document.querySelector('input#tel-search');
      if (phoneField && phoneField.value && phoneField.value.length >= 8) {
        // 最後に処理した電話番号と異なる場合のみ処理
        if (phoneField.value !== this.lastProcessedPhone) {
          console.log('定期チェックで新しい電話番号を検出:', phoneField.value);
          this.processPhoneNumber(phoneField.value);
        }
      }
      
      // テーブルとラジオボタンの存在チェック
      const table = document.querySelector('.table-registvendor');
      const radioButtons = document.querySelectorAll('input[type="radio"][value]');
      
      // テーブルがあり、ラジオボタンがあり、かつ最後に処理した電話番号がある場合
      if (table && radioButtons.length > 0 && this.lastProcessedPhone) {
        // 再度選択処理を試行
        this.executeVendorSelection(this.lastProcessedPhone);
      }
    }, 1000); // 1秒ごとにチェック
    */
  },
  
  // グローバルイベントハンドラ
  setupGlobalEventHandlers() {
    // キャプチャフェーズでイベントを捕捉（最速）
    document.removeEventListener('input', this._globalInputHandler, true);
    this._globalInputHandler = (e) => {
      if (e.target && e.target.id === 'tel-search') {
        this.handlePhoneInput(e);
      }
    };
    document.addEventListener('input', this._globalInputHandler, true);
    
    // キーイベントもグローバルに捕捉
    document.removeEventListener('keydown', this._globalKeyHandler, true);
    this._globalKeyHandler = (e) => {
      if (e.target && e.target.id === 'tel-search' && e.key === 'Enter') {
        this.handlePhoneKeyDown(e);
      }
    };
    document.addEventListener('keydown', this._globalKeyHandler, true);
    
    // フォーム送信のグローバル捕捉
    document.removeEventListener('submit', this._globalSubmitHandler, true);
    this._globalSubmitHandler = (e) => {
      const form = e.target;
      const phoneInput = form.querySelector('#tel-search');
      if (phoneInput && phoneInput.value) {
        console.log('グローバル: フォーム送信:', phoneInput.value);
        this.lastProcessedPhone = phoneInput.value;
        
        setTimeout(() => {
          this.executeVendorSelection(phoneInput.value);
        }, 300);
      }
    };
    document.addEventListener('submit', this._globalSubmitHandler, true);
  },
  
  // 電話番号入力ハンドラ
  handlePhoneInput(e) {
    const phoneNumber = e.target.value;
    if (!phoneNumber || phoneNumber.length < 8) return;
    
    // デバウンスなしで即時処理
    this.processPhoneNumber(phoneNumber);
  },
  
  // キーダウンハンドラ
  handlePhoneKeyDown(e) {
    // Enterキーの場合は即時処理（フォーム送信と並行）
    if (e.key === 'Enter') {
      const phoneNumber = e.target.value;
      if (phoneNumber && phoneNumber.length >= 8) {
        // 最優先で処理
        this.processPhoneNumber(phoneNumber, true);
      }
    }
  },
  
  // DOM変更の監視
  observeDOMChanges() {
    const observer = new MutationObserver(mutations => {
      let phoneFieldAdded = false;
      let tableAdded = false;
      let radioButtonsAdded = false;
      
      mutations.forEach(mutation => {
        if (mutation.type !== 'childList' || !mutation.addedNodes.length) return;
        
        Array.from(mutation.addedNodes).forEach(node => {
          if (node.nodeType !== 1) return; // 要素ノードのみ対象
          
          // 電話番号フィールドが追加された
          if (node.id === 'tel-search' || node.querySelector?.('#tel-search')) {
            phoneFieldAdded = true;
          }
          
          // テーブルが追加された
          if (node.classList?.contains('table-registvendor') || 
              node.querySelector?.('.table-registvendor')) {
            tableAdded = true;
          }
          
          // ラジオボタンが追加された
          if (node.querySelector?.('input[type="radio"][value]')) {
            radioButtonsAdded = true;
          }
        });
      });
      
      // 電話番号フィールドが追加されたら監視を設定
      if (phoneFieldAdded) {
        this.setupPhoneFieldWatcher();
      }
      
      // テーブルまたはラジオボタンが追加され、かつ直前に処理した電話番号がある場合は再処理
      if ((tableAdded || radioButtonsAdded) && this.lastProcessedPhone) {
        console.log('DOM変更検出: テーブルまたはラジオボタンが追加されました');
        // 少し遅延させて処理
        setTimeout(() => {
          this.executeVendorSelection(this.lastProcessedPhone);
        }, 300);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.domObservers.push(observer);
  },
  
  // 電話番号処理の中央ハブ
  processPhoneNumber(phoneNumber, isPriority = false) {
    if (!phoneNumber) return;
    
    // 処理済みならスキップ（連続入力防止）
    if (phoneNumber === this.lastProcessedPhone && !isPriority) return;
    
    this.lastProcessedPhone = phoneNumber;
    console.log(`電話番号処理: ${phoneNumber}`);
    
    // データが未ロードなら先にロード
    if (!this.vendorData) {
      this.preloadData().then(() => {
        this.executeVendorSelection(phoneNumber);
      });
    } else {
      // すでにデータがあれば即時実行
      this.executeVendorSelection(phoneNumber);
    }
  },
  
  // 通知表示メソッド（テーブル上に表示するバージョン）
// テーブル上部に固定表示する通知メソッド
showNotification(message, type = 'info') {
  // 既存の通知を削除
  this.removeNotifications();
  
  // 通知対象のテーブルを特定
  const table = document.querySelector('.table-registvendor');
  if (!table) {
    console.log('通知対象のテーブルが見つかりません');
    return this.showFixedNotification(message, type); // フォールバック
  }
  
  // テーブルの親コンテナを取得
  const tableContainer = table.closest('.table-container') || table.parentElement;
  if (!tableContainer) {
    return this.showFixedNotification(message, type); // フォールバック
  }
  
  // テーブルコンテナにposition: relativeを設定（通知の基準点になる）
  if (window.getComputedStyle(tableContainer).position === 'static') {
    tableContainer.style.position = 'relative';
  }
  
  // 新しい通知を作成
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.className = 'ultra-fast-notification table-notification';
  
  // 通知タイプに基づくスタイル設定
  const bgColor = type === 'error' ? '#ff5252' : 
                 type === 'success' ? '#4caf50' : '#2196f3';
  
  Object.assign(notification.style, {
    position: 'sticky', // スクロールに追従
    top: '0',           // テーブルコンテナの上部に固定
    left: '0',
    width: '100%',
    backgroundColor: bgColor,
    color: 'white',
    padding: '8px 16px',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    zIndex: '9999',     // 最前面に表示
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '10px',
    boxSizing: 'border-box'
  });
  
  // テーブルの直前に挿入
  tableContainer.insertBefore(notification, table);
  
  // 一定時間後に自動削除
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 12000); // 5秒間表示
  
  return notification;
},

// フォールバック用の固定位置通知（変更なし）
showFixedNotification(message, type = 'info') {
  // 既存の通知を削除
  this.removeNotifications();
  
  // 新しい通知を作成
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.className = 'ultra-fast-notification';
  
  // 通知タイプに基づくスタイル設定
  const bgColor = type === 'error' ? '#ff5252' : 
                 type === 'success' ? '#4caf50' : '#2196f3';
  
  Object.assign(notification.style, {
    position: 'fixed',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: bgColor,
    color: 'white',
    padding: '8px 16px',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    zIndex: '9999',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: '200px'
  });
  
  document.body.appendChild(notification);
  
  // 一定時間後に自動削除
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
  
  return notification;
},

// 通知削除メソッド
removeNotifications() {
  const notifications = document.querySelectorAll('.ultra-fast-notification');
  notifications.forEach(note => {
    if (note.parentNode) {
      note.parentNode.removeChild(note);
    }
  });
},

  // 修正版スクロール処理メソッド
scrollToElement(element) {
  if (!element) return;
  
  try {
    // まず要素が含まれるスクロール可能なコンテナを特定
    const findScrollableParent = (el) => {
      if (!el) return document.documentElement;
      
      const overflowY = window.getComputedStyle(el).overflowY;
      const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';
      
      if (isScrollable && el.scrollHeight > el.clientHeight) {
        return el;
      }
      
      return findScrollableParent(el.parentElement);
    };
    
    const container = findScrollableParent(element);
    
    // 要素の位置を取得
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // 現在のスクロール位置を基準に調整
    const currentScrollTop = container.scrollTop;
    const targetScrollTop = currentScrollTop + (elementRect.top - containerRect.top) - 80; // 上端から80px空ける
    
    // スムーズスクロールなしで即時スクロール
    container.scrollTop = targetScrollTop;
    
    // コンソールに情報を出力
    console.log('スクロール情報:', {
      element: element.tagName,
      container: container.tagName,
      currentScrollTop,
      targetScrollTop,
      elementTop: elementRect.top,
      containerTop: containerRect.top
    });
  } catch (error) {
    console.error('スクロールエラー:', error);
  }
},
  
  // 業者選択の実行部分
  executeVendorSelection(phoneNumber) {
    console.time('選択処理時間');
    
    try {
      // 電話番号の正規化
      const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
      
      // ラジオボタンが存在するか高速チェック
      if (!document.querySelector('input[type="radio"][value]')) {
        console.log('選択可能なラジオボタンが見つかりません');
        this.showNotification('業者リストがまだ読み込まれていません', 'info');
        console.timeEnd('選択処理時間');
        return;
      }
      
      // 最新エントリーを取得（事前計算済み）
      const latestEntry = this.latestEntryByPhone[normalizedPhone];
      
      if (!latestEntry || !latestEntry.vendorId) {
        console.log('該当する業者情報が見つかりません');
        this.showNotification(`電話番号: ${phoneNumber} に対応する業者が見つかりません`, 'error');
        console.timeEnd('選択処理時間');
        return;
      }
      
      console.log('選択する業者:', latestEntry);
      
      // ボタンを取得してクリック
      const vendorId = latestEntry.vendorId;
      
      // ボタンをキャッシュから取得、なければ検索
      let radioButton = this.buttonCache[vendorId];
      if (!radioButton || !document.body.contains(radioButton)) {
        radioButton = document.querySelector(`input[type="radio"][value="${vendorId}"]`);
        if (radioButton) {
          this.buttonCache[vendorId] = radioButton;
        }
      }
      
      if (radioButton) {
        // 行を取得
        const row = radioButton.closest('tr');
        
        // スクロール処理（即時）
        if (row) {
          this.scrollToElement(row);
        }
        
        // 即時クリック実行
        radioButton.click();
        
        // 最小限の視覚フィードバック（パフォーマンス優先）
        if (row) {
          // インラインスタイルで一瞬だけハイライト
          const originalBg = row.style.backgroundColor;
          row.style.backgroundColor = '#fffacd';
          
          // 最短時間で元に戻す
          setTimeout(() => {
            row.style.backgroundColor = originalBg;
          }, 300);
        }
        
        // 成功通知
        this.showNotification(`業者「${latestEntry.vendorName || ''}」を自動選択しました`, 'success');
        console.log('業者を選択しました:', vendorId);
      } else {
        console.log('対象のラジオボタンが見つかりません:', vendorId);
        this.showNotification(`業者ID: ${vendorId} が画面上に見つかりません`, 'error');
      }
    } catch (error) {
      console.error('選択処理エラー:', error);
      this.showNotification('選択処理中にエラーが発生しました', 'error');
    }
    
    console.timeEnd('選択処理時間');
  }
};
// executeVendorSelection メソッドの修正バージョン - 既存の UltraFastVendorSelector に統合
UltraFastVendorSelector.executeVendorSelection = function(phoneNumber) {
  console.time('選択処理時間');
  
  try {
    // 電話番号の正規化
    const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
    
    // ラジオボタンが存在するか高速チェック
    if (!document.querySelector('input[type="radio"][value]')) {
      console.log('選択可能なラジオボタンが見つかりません');
      this.showNotification('業者リストがまだ読み込まれていません', 'info');
      console.timeEnd('選択処理時間');
      return;
    }
    
    // 該当電話番号のエントリーを全て取得
    const entries = this.phoneIndex[normalizedPhone] || [];
    
    if (entries.length === 0) {
      console.log('該当する業者情報が見つかりません');
      this.showNotification(`電話番号: ${phoneNumber} に対応する業者が見つかりません`, 'error');
      console.timeEnd('選択処理時間');
      return;
    }
    
    // 有効なvendorIDを持つエントリーのみをフィルタリング
    const validEntries = entries.filter(entry => entry && entry.vendorId);
    
    // 複数の有効なエントリーがある場合は選択ダイアログを表示
    if (validEntries.length > 1) {
      console.log(`電話番号 ${phoneNumber} には ${validEntries.length} 件の候補があります`);
      this.showCandidateSelectionDialog(validEntries, phoneNumber);
      console.timeEnd('選択処理時間');
      return;
    }
    
    // 1つだけ有効なエントリーがある場合はそれを選択
    if (validEntries.length === 1) {
      const entry = validEntries[0];
      this.selectVendorById(entry.vendorId, entry.vendorName);
      console.timeEnd('選択処理時間');
      return;
    }
    
    // フォールバック：以前と同じく最新のエントリーを使用
    const latestEntry = this.latestEntryByPhone[normalizedPhone];
    
    if (!latestEntry || !latestEntry.vendorId) {
      console.log('有効な業者IDが見つかりません');
      this.showNotification(`電話番号: ${phoneNumber} に有効な業者IDが見つかりません`, 'error');
      console.timeEnd('選択処理時間');
      return;
    }
    
    // 最新エントリーを選択
    this.selectVendorById(latestEntry.vendorId, latestEntry.vendorName);
    
  } catch (error) {
    console.error('選択処理エラー:', error);
    this.showNotification('選択処理中にエラーが発生しました', 'error');
  }
  
  console.timeEnd('選択処理時間');
};

// 業者ID別選択メソッド - executeVendorSelectionから抽出
UltraFastVendorSelector.selectVendorById = function(vendorId, vendorName) {
  try {
    console.log('選択する業者ID:', vendorId);
    
    // ボタンをキャッシュから取得、なければ検索
    let radioButton = this.buttonCache[vendorId];
    if (!radioButton || !document.body.contains(radioButton)) {
      radioButton = document.querySelector(`input[type="radio"][value="${vendorId}"]`);
      if (radioButton) {
        this.buttonCache[vendorId] = radioButton;
      }
    }
    
    if (radioButton) {
      // 行を取得
      const row = radioButton.closest('tr');
      
      // スクロール処理
      if (row) {
        this.scrollToElement(row);
      }
      
      // ラジオボタンをクリック
      radioButton.click();
      
      // 視覚的なフィードバック
      if (row) {
        const originalBg = row.style.backgroundColor;
        row.style.backgroundColor = '#fffacd';
        
        setTimeout(() => {
          row.style.backgroundColor = originalBg;
        }, 300);
      }
      
      // 成功通知
      this.showNotification(`業者「${vendorName || ''}」を選択しました`, 'success');
      console.log('業者を選択しました:', vendorId);
      return true;
    } else {
      console.log('対象のラジオボタンが見つかりません:', vendorId);
      this.showNotification(`業者ID: ${vendorId} が画面上に見つかりません`, 'error');
      return false;
    }
  } catch (error) {
    console.error('選択処理エラー:', error);
    this.showNotification('選択処理中にエラーが発生しました', 'error');
    return false;
  }
};

// 重複を除去するヘルパーメソッド
UltraFastVendorSelector.getUniqueCandidates = function(candidates) {
  // vendorId と vendorName の組み合わせでユニークなエントリを特定
  const uniqueMap = new Map();
  
  candidates.forEach(candidate => {
    if (!candidate.vendorId) return; // 無効なエントリはスキップ
    
    const key = `${candidate.vendorId}|${candidate.vendorName || ''}`;
    
    // まだ同じ組み合わせがないか、新しいほうが日付が新しい場合は更新
    if (!uniqueMap.has(key) || 
        (candidate.timestamp && new Date(candidate.timestamp) > new Date(uniqueMap.get(key).timestamp || 0))) {
      uniqueMap.set(key, candidate);
    }
  });
  
  // Map からユニークな候補を配列に変換
  return Array.from(uniqueMap.values());
};

// ドラッグ可能にする機能
UltraFastVendorSelector.makeDraggable = function(element, handle) {
  let isDragging = false;
  let offsetX, offsetY;
  
  const onMouseDown = (e) => {
    // 右クリックでは動作しない
    if (e.button !== 0) return;
    
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    
    // スタイル変更
    element.style.opacity = '0.9';
    element.style.transition = 'none';
    
    // イベント伝播を止める
    e.preventDefault();
    e.stopPropagation();
  };
  
  const onMouseMove = (e) => {
    if (!isDragging) return;
    
    // 新しい位置を計算
    const left = e.clientX - offsetX;
    const top = e.clientY - offsetY;
    
    // 画面外にならないように制限
    const maxX = window.innerWidth - element.offsetWidth;
    const maxY = window.innerHeight - element.offsetHeight;
    
    element.style.left = `${Math.max(0, Math.min(maxX, left))}px`;
    element.style.top = `${Math.max(0, Math.min(maxY, top))}px`;
    
    // リストのクリックイベントを妨げないようにする
    e.preventDefault();
    e.stopPropagation();
  };
  
  const onMouseUp = () => {
    if (!isDragging) return;
    
    isDragging = false;
    element.style.opacity = '1';
    element.style.transition = 'opacity 0.2s';
  };
  
  // マウスイベントハンドラを設定
  handle.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  
  // クリーンアップ用にハンドラを保存
  element._dragHandlers = {
    handleMouseDown: onMouseDown,
    documentMouseMove: onMouseMove,
    documentMouseUp: onMouseUp
  };
};

// ダイアログを削除するヘルパーメソッド（更新版）
UltraFastVendorSelector.removeExistingDialog = function() {
  const existingDialog = document.getElementById('vendor-candidate-dialog');
  if (existingDialog) {
    // ドラッグハンドラをクリーンアップ
    if (existingDialog._dragHandlers) {
      const dragHandle = existingDialog.querySelector('.candidate-dialog-draghandle');
      if (dragHandle) {
        dragHandle.removeEventListener('mousedown', existingDialog._dragHandlers.handleMouseDown);
      }
      document.removeEventListener('mousemove', existingDialog._dragHandlers.documentMouseMove);
      document.removeEventListener('mouseup', existingDialog._dragHandlers.documentMouseUp);
    }
    
    // ダイアログを削除
    if (existingDialog.parentNode) {
      existingDialog.parentNode.removeChild(existingDialog);
    }
  }
};

// 候補選択ダイアログを表示（テーブル右わきにフロート表示、重複排除対応）
UltraFastVendorSelector.showCandidateSelectionDialog = function(candidates, phoneNumber) {
  // 既存のダイアログを削除
  this.removeExistingDialog();

  // 重複を除去した候補リストを作成
  const uniqueCandidates = this.getUniqueCandidates(candidates);
  
  if (uniqueCandidates.length === 0) {
    console.log('表示可能な候補がありません');
    this.showNotification('有効な候補が見つかりません', 'error');
    return;
  }
  
  // 表示する候補が1つだけの場合は直接選択
  if (uniqueCandidates.length === 1) {
    const candidate = uniqueCandidates[0];
    console.log('重複除去後の候補が1つのみです。直接選択します:', candidate.vendorName);
    this.selectVendorById(candidate.vendorId, candidate.vendorName);
    return;
  }
  
  // ダイアログコンテナを作成
  const dialog = document.createElement('div');
  dialog.className = 'candidate-selection-dialog';
  dialog.setAttribute('id', 'vendor-candidate-dialog');
  
  // 初期位置の計算 - テーブルコンテナの右側に表示
  const table = document.querySelector('.table-registvendor');
  let initialPosition = { right: '20px', top: '100px' };
  
  if (table) {
    const tableRect = table.getBoundingClientRect();
    const tableContainer = table.closest('.table-container') || table.parentElement;
    
    if (tableContainer) {
      const containerRect = tableContainer.getBoundingClientRect();
      initialPosition = {
        left: `${containerRect.right + 20}px`,
        top: `${containerRect.top}px`
      };
    }
  }
  
  // ダイアログのスタイル設定
  Object.assign(dialog.style, {
    position: 'fixed',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    borderRadius: '8px',
    padding: '16px',
    zIndex: '10000',
    width: '350px',
    maxHeight: '80vh',
    overflowY: 'auto',
    cursor: 'move',
    ...initialPosition
  });
  
  // ドラッグ用のヘッダーバーを作成
  const dragHandle = document.createElement('div');
  dragHandle.className = 'candidate-dialog-draghandle';
  Object.assign(dragHandle.style, {
    padding: '8px 0',
    marginBottom: '8px',
    borderBottom: '1px solid #eee',
    cursor: 'move',
    userSelect: 'none'
  });
  
  // ヘッダーにタイトルを追加
  const headerTitle = document.createElement('span');
  headerTitle.textContent = `電話番号 ${phoneNumber} の候補`;
  headerTitle.style.fontWeight = 'bold';
  headerTitle.style.fontSize = '14px';
  dragHandle.appendChild(headerTitle);
  
  // 閉じるボタンを作成
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.onclick = () => this.removeExistingDialog();
  Object.assign(closeButton.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666'
  });
  
  // 候補カウンター
  const counterSpan = document.createElement('span');
  counterSpan.textContent = `${uniqueCandidates.length}件`;
  counterSpan.style.fontSize = '12px';
  counterSpan.style.color = '#666';
  counterSpan.style.marginLeft = '8px';
  headerTitle.appendChild(counterSpan);
  
  // 候補リストを作成
  const list = document.createElement('div');
  
  // 候補をタイムスタンプでソート（最新順）
  uniqueCandidates.sort((a, b) => {
    const dateA = new Date(a.timestamp || 0);
    const dateB = new Date(b.timestamp || 0);
    return dateB - dateA;
  });
  
  // 候補をリストに追加
  uniqueCandidates.forEach((candidate, index) => {
    const item = document.createElement('div');
    
    // 日付の表示形式を整形
    let dateDisplay = '日付不明';
    if (candidate.timestamp) {
      try {
        const date = new Date(candidate.timestamp);
        dateDisplay = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } catch (e) {
        console.error('日付変換エラー:', e);
      }
    }
    
    item.className = 'candidate-item';
    Object.assign(item.style, {
      padding: '10px',
      margin: '8px 0',
      backgroundColor: index === 0 ? '#f0f8ff' : '#f5f5f5',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      border: index === 0 ? '1px solid #2196f3' : '1px solid #ddd'
    });
    
    // 項目の内容
    item.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${candidate.vendorName || '名称なし'}</div>
      <div style="color: #555; font-size: 12px;">
        ${candidate.vendorPhonetic ? `<div>フリガナ: ${candidate.vendorPhonetic}</div>` : ''}
        ${candidate.vendorIndustry ? `<div>業種: ${candidate.vendorIndustry}</div>` : ''}
        <div style="color: #888; font-size: 11px; margin-top: 4px;">登録日時: ${dateDisplay}</div>
      </div>
    `;
    
    // ホバーエフェクト
    item.onmouseover = () => {
      item.style.backgroundColor = '#e3f2fd';
    };
    item.onmouseout = () => {
      item.style.backgroundColor = index === 0 ? '#f0f8ff' : '#f5f5f5';
    };
    
    // クリックハンドラ
    item.onclick = () => {
      this.removeExistingDialog();
      this.selectVendorById(candidate.vendorId, candidate.vendorName);
    };
    
    list.appendChild(item);
  });
  
  // ダイアログを組み立て
  dialog.appendChild(closeButton);
  dialog.appendChild(dragHandle);
  dialog.appendChild(list);
  
  // ダイアログをドキュメントに追加
  document.body.appendChild(dialog);
  
  // ドラッグ機能の実装
  this.makeDraggable(dialog, dragHandle);
  
  return dialog;
};

// 追加のスタイル定義
const candidateDialogStyle = document.createElement('style');
candidateDialogStyle.textContent = `
  .candidate-selection-dialog {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    transition: box-shadow 0.3s;
    z-index: 10000;
  }
  
  .candidate-selection-dialog:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  }
  
  .candidate-dialog-draghandle {
    cursor: grab;
  }
  
  .candidate-dialog-draghandle:active {
    cursor: grabbing;
  }
  
  .candidate-item {
    box-sizing: border-box;
    transition: transform 0.15s ease-out;
  }
  
  .candidate-item:hover {
    transform: translateX(2px);
  }
  
  .candidate-item:first-child {
    position: relative;
  }
  
  .candidate-item:first-child::after {
    content: '最新';
    position: absolute;
    top: -6px;
    right: -6px;
    background-color: #2196f3;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 8px;
  }
`;
document.head.appendChild(candidateDialogStyle);

// 改修後の初期化確認
if (typeof UltraFastVendorSelector !== 'undefined' && !UltraFastVendorSelector._enhancedVersion) {
  console.log('UltraFastVendorSelector を拡張しました (v1.1) - 重複排除とドラッグ可能ダイアログ対応');
  UltraFastVendorSelector._enhancedVersion = '1.1';
}



// 1. 重複排除と最新履歴に基づく自動選択を組み込んだ改良版
UltraFastVendorSelector.showCandidateSelectionDialog = function(candidates, phoneNumber) {
  // 既存のダイアログを削除
  this.removeExistingDialog();

  // 重複を除去した候補リストを作成
  const uniqueCandidates = this.getUniqueCandidates(candidates);
  
  if (uniqueCandidates.length === 0) {
    console.log('表示可能な候補がありません');
    this.showNotification('有効な候補が見つかりません', 'error');
    return;
  }
  
  // 表示する候補が1つだけの場合は直接選択
  if (uniqueCandidates.length === 1) {
    const candidate = uniqueCandidates[0];
    console.log('重複除去後の候補が1つのみです。直接選択します:', candidate.vendorName);
    this.selectVendorById(candidate.vendorId, candidate.vendorName);
    return;
  }
  
  // ダイアログコンテナを作成
  const dialog = document.createElement('div');
  dialog.className = 'candidate-selection-dialog';
  dialog.setAttribute('id', 'vendor-candidate-dialog');
  
  // 初期位置の計算 - テーブルコンテナの右側に表示
  const table = document.querySelector('.table-registvendor');
  let initialPosition = { right: '20px', top: '100px' };
  
  if (table) {
    const tableRect = table.getBoundingClientRect();
    const tableContainer = table.closest('.table-container') || table.parentElement;
    
    if (tableContainer) {
      const containerRect = tableContainer.getBoundingClientRect();
      initialPosition = {
        left: `${containerRect.right + 20}px`,
        top: `${containerRect.top}px`
      };
    }
  }
  
  // ダイアログのスタイル設定
  Object.assign(dialog.style, {
    position: 'fixed',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    borderRadius: '8px',
    padding: '16px',
    zIndex: '10000',
    width: '350px',
    maxHeight: '80vh',
    overflowY: 'auto',
    cursor: 'move',
    ...initialPosition
  });
  
  // ドラッグ用のヘッダーバーを作成
  const dragHandle = document.createElement('div');
  dragHandle.className = 'candidate-dialog-draghandle';
  Object.assign(dragHandle.style, {
    padding: '8px 0',
    marginBottom: '8px',
    borderBottom: '1px solid #eee',
    cursor: 'move',
    userSelect: 'none'
  });
  
  // ヘッダーにタイトルを追加
  const headerTitle = document.createElement('span');
  headerTitle.textContent = `電話番号 ${phoneNumber} の候補`;
  headerTitle.style.fontWeight = 'bold';
  headerTitle.style.fontSize = '14px';
  dragHandle.appendChild(headerTitle);
  
  // 閉じるボタンを作成
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.onclick = () => this.removeExistingDialog();
  Object.assign(closeButton.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666'
  });
  
  // 候補カウンター
  const counterSpan = document.createElement('span');
  counterSpan.textContent = `${uniqueCandidates.length}件`;
  counterSpan.style.fontSize = '12px';
  counterSpan.style.color = '#666';
  counterSpan.style.marginLeft = '8px';
  headerTitle.appendChild(counterSpan);
  
  // 候補リストを作成
  const list = document.createElement('div');
  
  // 候補をタイムスタンプでソート（最新順）
  uniqueCandidates.sort((a, b) => {
    const dateA = new Date(a.timestamp || 0);
    const dateB = new Date(b.timestamp || 0);
    return dateB - dateA;
  });
  
  // 最新の候補を取得（タイムスタンプが最新のもの）
  const latestCandidate = uniqueCandidates[0];
  
  // 候補をリストに追加
  uniqueCandidates.forEach((candidate, index) => {
    const item = document.createElement('div');
    
    // 日付の表示形式を整形
    let dateDisplay = '日付不明';
    if (candidate.timestamp) {
      try {
        const date = new Date(candidate.timestamp);
        dateDisplay = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } catch (e) {
        console.error('日付変換エラー:', e);
      }
    }
    
    item.className = 'candidate-item';
    item.setAttribute('data-vendor-id', candidate.vendorId);
    Object.assign(item.style, {
      padding: '10px',
      margin: '8px 0',
      backgroundColor: index === 0 ? '#f0f8ff' : '#f5f5f5',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      border: index === 0 ? '1px solid #2196f3' : '1px solid #ddd'
    });
    
    // 項目の内容
    item.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${candidate.vendorName || '名称なし'}</div>
      <div style="color: #555; font-size: 12px;">
        ${candidate.vendorPhonetic ? `<div>フリガナ: ${candidate.vendorPhonetic}</div>` : ''}
        ${candidate.vendorIndustry ? `<div>業種: ${candidate.vendorIndustry}</div>` : ''}
        <div style="color: #888; font-size: 11px; margin-top: 4px;">登録日時: ${dateDisplay}</div>
      </div>
    `;
    
    // ホバーエフェクト
    item.onmouseover = () => {
      item.style.backgroundColor = '#e3f2fd';
    };
    item.onmouseout = () => {
      item.style.backgroundColor = item.classList.contains('selected') ? '#e3f2fd' : 
                                  (index === 0 ? '#f0f8ff' : '#f5f5f5');
    };
    
    // クリックハンドラ - ダイアログは閉じずに選択状態にする
    item.onclick = () => {
      // 選択中のアイテムのスタイルをリセット
      const selectedItems = list.querySelectorAll('.candidate-item.selected');
      selectedItems.forEach(selected => {
        selected.classList.remove('selected');
        selected.style.backgroundColor = selected === item ? '#e3f2fd' : '#f5f5f5';
        selected.style.borderLeft = '1px solid #ddd';
      });
      
      // このアイテムを選択状態にする
      item.classList.add('selected');
      item.style.backgroundColor = '#e3f2fd';
      item.style.borderLeft = '4px solid #2196f3';
      
      // ラジオボタンを選択する
      this.selectVendorById(candidate.vendorId, candidate.vendorName, false); // 第3引数にfalseを渡して通知を抑制
      
      // 選択した候補の情報をダイアログに保存（後でセーブボタン押下時に参照するため）
      dialog.dataset.selectedVendorId = candidate.vendorId;
      dialog.dataset.selectedVendorName = candidate.vendorName;
    };
    
    list.appendChild(item);
  });
  
  // メッセージ領域を追加
  const messageArea = document.createElement('div');
  messageArea.className = 'dialog-message-area';
  messageArea.style.marginTop = '15px';
  messageArea.style.fontSize = '13px';
  messageArea.style.color = '#666';
  messageArea.style.fontStyle = 'italic';
  messageArea.textContent = 'Saveボタンを押すまでこのダイアログは表示されたままです。何度でも選び直せます。';
  
  // ダイアログを組み立て
  dialog.appendChild(closeButton);
  dialog.appendChild(dragHandle);
  dialog.appendChild(list);
  dialog.appendChild(messageArea);
  
  // ダイアログをドキュメントに追加
  document.body.appendChild(dialog);
  
  // ドラッグ機能の実装
  this.makeDraggable(dialog, dragHandle);
  
  // Saveボタンのクリック監視を設定
  this.setupSaveButtonListener();
  
  // 最新の候補を自動選択（デフォルト選択として）
  if (latestCandidate) {
    // 最新の候補要素を選択
    const latestItem = list.querySelector(`.candidate-item[data-vendor-id="${latestCandidate.vendorId}"]`);
    if (latestItem) {
      // 選択状態にする
      latestItem.classList.add('selected');
      latestItem.style.backgroundColor = '#e3f2fd';
      latestItem.style.borderLeft = '4px solid #2196f3';
      
      // ラジオボタンを選択
      this.selectVendorById(latestCandidate.vendorId, latestCandidate.vendorName, false);
      
      // 選択情報をダイアログに保存
      dialog.dataset.selectedVendorId = latestCandidate.vendorId;
      dialog.dataset.selectedVendorName = latestCandidate.vendorName;
      
      console.log('最新の候補を自動選択しました:', latestCandidate.vendorName);
    }
  }
  
  return dialog;
};

// 2. 重複を除去するメソッドの強化版
UltraFastVendorSelector.getUniqueCandidates = function(candidates) {
  // vendorId でユニークなエントリーを特定（同じIDは最新のタイムスタンプのものを使用）
  const uniqueMap = new Map();
  
  candidates.forEach(candidate => {
    if (!candidate || !candidate.vendorId) return; // 無効なエントリーはスキップ
    
    const key = candidate.vendorId;
    
    // まだ同じIDがないか、新しいほうが日付が新しい場合は更新
    if (!uniqueMap.has(key) || 
        (candidate.timestamp && new Date(candidate.timestamp) > new Date(uniqueMap.get(key).timestamp || 0))) {
      uniqueMap.set(key, candidate);
    }
  });
  
  // Map からユニークな候補を配列に変換
  return Array.from(uniqueMap.values());
};

// 3. 以前のコードとの競合を防ぐためのメソッド上書き
if (!UltraFastVendorSelector._originalRemoveExistingDialog) {
  UltraFastVendorSelector._originalRemoveExistingDialog = UltraFastVendorSelector.removeExistingDialog;
}

UltraFastVendorSelector.removeExistingDialog = function() {
  // 元の処理を実行
  UltraFastVendorSelector._originalRemoveExistingDialog.call(this);
  
  // Saveボタンのイベントリスナーもクリーンアップ
  if (this._saveButtonHandler) {
    document.removeEventListener('click', this._saveButtonHandler, true);
    this._saveButtonHandler = null;
  }
};

// setupSaveButtonListener メソッドを追加
UltraFastVendorSelector.setupSaveButtonListener = function() {
  // 既存のリスナーを削除
  if (this._saveButtonHandler) {
    document.removeEventListener('click', this._saveButtonHandler);
  }
  
  // Saveボタンのクリックを監視
  this._saveButtonHandler = (e) => {
    if (e.target.matches('.btn-save')) {
      console.log('Saveボタンクリックを検知');
      
      // ダイアログがある場合
      const dialog = document.getElementById('vendor-candidate-dialog');
      if (dialog) {
        // 選択されている業者情報があればその情報を取得
        const vendorId = dialog.dataset.selectedVendorId;
        const vendorName = dialog.dataset.selectedVendorName;
        
        if (vendorId) {
          console.log('保存時に選択されていた業者:', vendorName, vendorId);
          
          // 成功通知を表示
          this.showNotification(`業者「${vendorName || ''}」で保存しました`, 'success');
          
          // 選択した業者情報をコンソールに出力（デバッグ用）
          console.log('保存された業者情報:', {
            vendorId,
            vendorName
          });
        }
        
        // ダイアログを閉じる
        this.removeExistingDialog();
      }
    }
  };
  
  // キャプチャフェーズで実行（他のクリックイベントより先に実行されるようにする）
  document.addEventListener('click', this._saveButtonHandler, true);
};

// エラー防止のため、メソッドが無い場合のチェックを追加
if (typeof UltraFastVendorSelector.showCandidateSelectionDialog === 'function' &&
    typeof UltraFastVendorSelector.setupSaveButtonListener === 'function') {
  console.log('必要なメソッドが正常に定義されています');
} else {
  console.error('一部のメソッドが定義されていません');
}


// 改修後の初期化確認
if (typeof UltraFastVendorSelector !== 'undefined' && UltraFastVendorSelector._enhancedVersion !== '1.3') {
  console.log('UltraFastVendorSelector を拡張しました (v1.3) - 重複排除強化と自動選択機能追加');
  UltraFastVendorSelector._enhancedVersion = '1.3';
}


// スタイルの定義（通知表示用のアニメーション追加）
const autoSelectStyle = document.createElement('style');
autoSelectStyle.textContent = `
  .auto-select-highlight {
    background-color: #fffacd !important;
    animation: highlightFade 3s ease-out;
  }

  @keyframes highlightFade {
    0% { background-color: #ffeb3b !important; }
    100% { background-color: transparent; }
  }
  
  .ultra-fast-notification {
    animation: fadeInOut 3s ease-in-out;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    box-sizing: border-box;
  }
  
  .table-notification {
    display: block;
    margin-bottom: 10px;
    width: calc(100% - 20px) !important;
    margin-left: auto;
    margin-right: auto;
  }
  
  @keyframes fadeInOut {
    0% { opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
document.head.appendChild(autoSelectStyle);

// ページ読み込み時の初期化（最速で実行）
(() => {
  // URL_B変数が存在する場合はその値を使用、存在しなければデフォルト値を設定
  const TARGET_URL = typeof URL_B !== 'undefined' ? URL_B : "https://dock.streamedup.com/receipt2/step/registvendor?step=regist";
  
  if (window.location.href.includes(TARGET_URL)) {
    UltraFastVendorSelector.init();
  }
  
  // URL変更監視
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
      // ★追加：URL変更時にクリーンアップ
      if (!currentUrl.includes(TARGET_URL)) {
        UltraFastVendorSelector.cleanupObservers();
      } else {
        UltraFastVendorSelector.init();
      }
  });
  
  urlObserver.observe(document, { subtree: true, childList: true });
    // ★追加：このobserverもクリーンアップ対象に追加
  if (UltraFastVendorSelector.domObservers) {
    UltraFastVendorSelector.domObservers.push(urlObserver);
  }
})();