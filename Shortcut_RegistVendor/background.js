// グローバル状態の管理
let count = 0;
let isRunning = false;
const MAX_ITERATIONS = 5;
const URL_A = "https://dock.streamedup.com/receipt2/verification";
const URL_B = "https://dock.streamedup.com/receipt2/step/registvendor?step=regist";

// Service Workerのインストール時の初期化
chrome.runtime.onInstalled.addListener(() => {
    console.log('拡張機能がインストールされました');
    chrome.storage.local.set({ 
        isRunning: false,
        rightClickEnabled: true,
        operationMode: false,  // false = モード1, true = モード2
        vendorEntries: []  // 業者データ用の配列を初期化
    });
});

// メッセージハンドラー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('メッセージを受信:', message);

    // プロセスの開始/停止の切り替え
    if (message.action === "startProcess") {
        isRunning = true;
        count = 0;
        startProcess();
        sendResponse({ success: true, isRunning: true });
        
        // ポップアップに状態変更を通知（エラーハンドリング付き）
        notifyPopupSafely({
            action: "updatePopupState",
            isRunning: true
        });
    }
    else if (message.action === "stopProcess") {
        isRunning = false;
        sendResponse({ success: true, isRunning: false });
        
        // ポップアップに状態変更を通知（エラーハンドリング付き）
        notifyPopupSafely({
            action: "updatePopupState",
            isRunning: false
        });
    }
    // 状態の取得
    else if (message.action === "getState") {
        sendResponse({ isRunning: isRunning });
    }
    // 画像表示
    else if (message.action === "showImage") {
        sendMessageToTab(sender.tab.id, { action: "displayImage" });
    }
    // 業者データの追加
    else if (message.action === "appendVendorEntry") {
        handleVendorEntry(message.entry).then(response => {
            sendResponse(response);
        }).catch(error => {
            console.error('Vendor entry error:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    // データのダウンロード
    else if (message.action === "downloadVendorData") {
        handleDataDownload().then(response => {
            sendResponse(response);
        }).catch(error => {
            console.error('Download error:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    return true; // 非同期レスポンスのために必要
});

// エラーハンドリング付きメッセージ送信関数
async function sendMessageToTab(tabId, message) {
    if (!tabId) {
        console.warn('無効なタブID:', tabId);
        return false;
    }

    try {
        // タブが存在するかチェック
        const tab = await chrome.tabs.get(tabId);
        if (!tab) {
            console.warn('タブが存在しません:', tabId);
            return false;
        }

        const response = await chrome.tabs.sendMessage(tabId, message);
        console.log('タブへのメッセージ送信成功:', response);
        return true;
    } catch (error) {
        console.log('タブへのメッセージ送信失敗（タブが存在しないか、スクリプトが注入されていません）:', error.message);
        return false;
    }
}

// ポップアップへの安全なメッセージ送信
function notifyPopupSafely(message) {
    try {
        // ポップアップが開いているかチェック
        chrome.runtime.sendMessage(message)
            .then(response => {
                console.log('ポップアップへの通知成功:', response);
            })
            .catch(error => {
                console.log('ポップアップは閉じています（正常な動作）:', error.message);
            });
    } catch (error) {
        console.log('ポップアップへの通知エラー:', error.message);
    }
}

// プロセス開始
function startProcess() {
    console.log('startProcess called:', { isRunning, count });
    if (isRunning && count < MAX_ITERATIONS) {
        count++;
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { url: URL_A })
                    .then(() => {
                        console.log('タブの更新が完了しました');
                    })
                    .catch(error => {
                        console.error('Tab update error:', error);
                    });
            }
        });
    }
}

// タブの更新イベントハンドラー
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.url || !isRunning) return;

    if (changeInfo.status === 'complete') {
        if (tab.url === URL_A) {
            console.log('URL_A detected, executing script');
            executeScriptSafely(tabId, clickButtonA);
        }
        else if (tab.url.includes(URL_B)) {
            console.log('URL_B detected, executing script');
            executeScriptSafely(tabId, checkElementB);
        }
    }
});

// 安全なスクリプト実行関数
function executeScriptSafely(tabId, func) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: func
    })
    .then(result => {
        console.log('スクリプト実行成功:', result);
    })
    .catch(error => {
        console.error('スクリプト実行エラー:', error);
        // タブが存在しない、またはアクセス権限がない場合の処理
        if (error.message.includes('Cannot access') || error.message.includes('No tab with id')) {
            console.log('タブにアクセスできません。タブが閉じられたか、権限がありません。');
        }
    });
}

// URL_Aページでのボタンクリック処理
function clickButtonA() {
    const button = document.querySelector('a.btn.btn-critical.btn-lg.btn-block-left[href="/receipt2/step/registvendor?step=regist"]');
    if (button) {
        console.log('Button found, clicking');
        button.click();
    } else {
        console.log('Button not found');
    }
}

// URL_Bページでのチェック処理（動作モード対応版）
function checkElementB() {
    const checkElement = async () => {
        const checkbox = document.querySelector('input#checkbox-add-key-tel.add-key-checkbox[data-checkbox="add-key-tel"]');
        const targetDiv = document.querySelector('.kvs-label');

        if (checkbox && targetDiv) {
            if (checkbox.checked && targetDiv.classList.contains('hidden')) {
                console.log("Checkbox is checked. Stopping the process.");
                
                // background.jsに停止メッセージを送信（エラーハンドリング付き）
                try {
                    await chrome.runtime.sendMessage({ action: "stopProcess" });
                } catch (error) {
                    console.error('停止メッセージの送信に失敗:', error);
                }
                return true;
            } else {
                // 動作モードを確認
                try {
                    const result = await chrome.storage.local.get(['operationMode']);
                    const operationMode = result.operationMode || false;
                    
                    if (operationMode) {
                        // モード2: 常にEscapeキーを押さない
                        console.log("モード2: Escapeキーを押しません（手動操作モード）");
                        return true;
                    } else {
                        // モード1: 電話番号と候補の存在確認
                        const phoneInput = document.querySelector('#tel-search');
                        const hasPhoneNumber = phoneInput && phoneInput.value && phoneInput.value.trim().length > 0;
                        
                        const table = document.querySelector('.table-registvendor');
                        const radioButtons = document.querySelectorAll('input[type="radio"][value]');
                        const hasCandidates = table && radioButtons.length > 0;
                        
                        // 電話番号があり、かつ候補もある場合のみEscapeキーを押さない
                        if (hasPhoneNumber && hasCandidates) {
                            console.log("モード1: 電話番号と候補が存在するため、Escapeキーを押しません");
                            return true;
                        } else {
                            // 電話番号がない、または候補がない場合はEscapeキーを押す
                            console.log("モード1: 電話番号または候補がないため、Escapeキーを押下します", {
                                hasPhoneNumber,
                                hasCandidates
                            });
                            document.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Escape' }));
                            return true;
                        }
                    }
                } catch (error) {
                    console.error('ストレージアクセスエラー:', error);
                    // エラーの場合はデフォルトでEscapeキーを押す
                    document.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Escape' }));
                    return true;
                }
            }
        }
        return false;
    };

    const attemptCheck = async () => {
        try {
            if (!(await checkElement())) {
                requestAnimationFrame(attemptCheck);
            }
        } catch (error) {
            console.error('チェック処理エラー:', error);
        }
    };

    attemptCheck();
}

// 業者データ追加の処理
async function handleVendorEntry(newEntry) {
    try {
        console.log('新規エントリーを追加:', newEntry);
        const result = await chrome.storage.local.get(['vendorEntries']);
        const entries = result.vendorEntries || [];
        entries.push(newEntry);
        await chrome.storage.local.set({ vendorEntries: entries });
        return { success: true };
    } catch (error) {
        console.error('エントリー保存エラー:', error);
        throw new Error(`Failed to save vendor entry: ${error.message}`);
    }
}

// データダウンロードの処理
async function handleDataDownload() {
    try {
        console.log('データダウンロードを開始');
        const result = await chrome.storage.local.get(['vendorEntries']);
        return { 
            success: true, 
            data: result.vendorEntries || [] 
        };
    } catch (error) {
        console.error('データダウンロードエラー:', error);
        throw new Error(`Failed to download data: ${error.message}`);
    }
}

// データクリア機能（必要に応じて）
async function clearVendorEntries() {
    try {
        await chrome.storage.local.set({ vendorEntries: [] });
        return { success: true };
    } catch (error) {
        console.error('データクリアエラー:', error);
        throw new Error(`Failed to clear entries: ${error.message}`);
    }
}