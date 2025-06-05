document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleButton');
    const statusDiv = document.getElementById('status');
    const rightClickToggle = document.getElementById('rightClickEnabled');
    const operationModeToggle = document.getElementById('operationMode');
    const modeIndicator = document.getElementById('modeIndicator');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const downloadButton = document.getElementById('downloadButton');
    const entryCountElement = document.getElementById('entryCount');
    let isRunning = false;

    // 初期状態の読み込み
    initializeState();

    // 安全なメッセージ送信関数
    async function sendMessageSafely(message) {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('メッセージ送信エラー:', error.message);
            if (error.message.includes('Could not establish connection')) {
                showError('拡張機能の再読み込みが必要です。');
                disableAllControls();
                return null;
            }
            throw error;
        }
    }

    // 初期化関数
    async function initializeState() {
        try {
            // まず保存された状態を確認
            const stored = await chrome.storage.local.get(['isRunning', 'rightClickEnabled', 'operationMode']);
            isRunning = stored.isRunning || false;
            rightClickEnabled = stored.rightClickEnabled !== undefined ? stored.rightClickEnabled : true;
            operationMode = stored.operationMode !== undefined ? stored.operationMode : false; // false = モード1, true = モード2

            // バックグラウンドの現在の状態も確認
            const response = await sendMessageSafely({ action: "getState" });
            if (response) {
                isRunning = response.isRunning;
            }

            // UIを更新
            updateUIState();
            rightClickToggle.checked = rightClickEnabled;
            operationModeToggle.checked = operationMode;
            updateModeIndicator();
            console.log('初期状態を読み込み:', { isRunning, rightClickEnabled, operationMode });

            // エントリ数を更新
            updateEntryCount();
        } catch (error) {
            console.error('状態の初期化エラー:', error);
            // エラー時はデフォルトで停止状態に
            isRunning = false;
            updateUIState();
        }
    }

    // トグルボタンのイベントリスナー
    toggleButton.addEventListener('click', async function() {
        try {
            const action = isRunning ? "stopProcess" : "startProcess";
            console.log('アクションを送信:', action);

            const response = await sendMessageSafely({ action: action });
            console.log('レスポンスを受信:', response);

            if (response && response.success) {
                isRunning = response.isRunning;
                await chrome.storage.local.set({ isRunning: isRunning });
                updateUIState();
                console.log('状態を更新:', isRunning ? '開始' : '停止');
            } else if (response === null) {
                // sendMessageSafely でエラーが処理済み
                return;
            } else {
                console.error('無効なレスポンス:', response);
                throw new Error('状態の更新に失敗しました');
            }
        } catch (error) {
            console.error('トグル処理エラー:', error);
            showError('処理に失敗しました。再度お試しください。');
        }
    });

    // 右クリック機能のトグル
    rightClickToggle.addEventListener('change', function() {
        rightClickEnabled = this.checked;
        chrome.storage.local.set({rightClickEnabled: rightClickEnabled});
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateRightClickSetting",
                enabled: rightClickEnabled
            }).catch(error => {
                console.log('コンテンツスクリプトへのメッセージ送信失敗:', error.message);
            });
        });
    });

    // 動作モードのトグル
    operationModeToggle.addEventListener('change', function() {
        operationMode = this.checked;
        chrome.storage.local.set({operationMode: operationMode});
        updateModeIndicator();
        
        // content scriptに動作モードの変更を通知
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateOperationMode",
                mode: operationMode
            }).catch(error => {
                console.log('コンテンツスクリプトへのメッセージ送信失敗:', error.message);
            });
        });
        
        console.log('動作モードを変更:', operationMode ? 'モード2' : 'モード1');
    });

    // モード表示の更新
    function updateModeIndicator() {
        if (operationMode) {
            modeIndicator.textContent = "モード2: 常にEscapeキーを押さない";
            modeIndicator.style.color = "#dc3545";
        } else {
            modeIndicator.textContent = "モード1: 従来の動作";
            modeIndicator.style.color = "#666";
        }
    }

    // アップロードボタンのクリックハンドラー
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    // ファイル選択時のハンドラー
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await readFileContent(file);
            let entries = [];

            // ファイル形式の自動判別とパース
            try {
                // まずJSONとして解析を試みる
                const jsonData = JSON.parse(content);
                console.log('JSONフォーマットとして解析成功');
                entries = jsonData.entries;
                if (!Array.isArray(entries)) {
                    throw new Error('JSON形式が不正です');
                }
            } catch (jsonError) {
                console.log('JSONとして解析失敗、CSVとして解析を試みます');
                entries = parseCSV(content);
            }

            if (!Array.isArray(entries) || entries.length === 0) {
                throw new Error('有効なデータが見つかりません');
            }

            // データの検証
            validateEntries(entries);

            // 既存のデータを取得して結合
            const result = await chrome.storage.local.get(['vendorEntries']);
            let existingEntries = result.vendorEntries || [];

            // 重複チェック
            const newEntries = entries.filter(newEntry => {
                return !existingEntries.some(existingEntry => 
                    existingEntry.phoneNumber === newEntry.phoneNumber &&
                    existingEntry.vendorId === newEntry.vendorId
                );
            });

            // 結合したデータを保存
            const updatedEntries = [...existingEntries, ...newEntries];
            await chrome.storage.local.set({ vendorEntries: updatedEntries });

            // UI更新
            updateEntryCount();
            showFeedback(uploadButton, `${newEntries.length}件のデータを追加しました`, true);

        } catch (error) {
            console.error('アップロードエラー:', error);
            showFeedback(uploadButton, `エラー: ${error.message}`, false);
        }

        // 入力をクリア
        fileInput.value = '';
    });

    // ダウンロードボタンのクリックハンドラー
    downloadButton.addEventListener('click', async function() {
        try {
            const format = document.querySelector('input[name="downloadFormat"]:checked').value;
            const response = await sendMessageSafely({
                action: 'downloadVendorData'
            });

            if (!response) {
                // sendMessageSafely でエラーが処理済み
                return;
            }

            if (!response.success) {
                throw new Error(response.error || 'データの取得に失敗しました');
            }

            let blob;
            let filename;

           // popup.jsのdownloadButtonクリックハンドラー内：
if (format === 'csv') {
    // CSVコンテンツの生成
    const csvContent = convertToCSV(response.data);
    
    // 最もシンプルかつ確実な方法: BOMを文字列として直接付加
    const bomPrefixedCsv = '\ufeff' + csvContent;
    
    // Blobの作成
    blob = new Blob([bomPrefixedCsv], { type: 'text/csv;charset=utf-8' });
    filename = 'vendor_phone_backup.csv';
} else {
    // 既存のJSON処理コード
    const jsonData = JSON.stringify({ entries: response.data }, null, 2);
    blob = new Blob([jsonData], { type: 'application/json' });
    filename = 'vendor_phone_backup.json';
}

            const url = URL.createObjectURL(blob);

            try {
                await chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                });
                showFeedback(downloadButton, 'ダウンロード完了!', true);
            } finally {
                URL.revokeObjectURL(url);
            }

        } catch (error) {
            console.error('ダウンロードエラー:', error);
            showFeedback(downloadButton, 'エラーが発生しました', false);
        }
    });

    // 拡張機能からのメッセージリスナー
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updatePopupState") {
            isRunning = message.isRunning;
            updateUIState();
        }
    });

    // UI状態の更新関数
    function updateUIState() {
        console.log('UI状態を更新:', { isRunning });
        
        if (isRunning) {
            toggleButton.textContent = "停止";
            toggleButton.className = "stop";
            statusDiv.textContent = "状態: 実行中";
            statusDiv.className = "running";
        } else {
            toggleButton.textContent = "開始";
            toggleButton.className = "start";
            statusDiv.textContent = "状態: 停止中";
            statusDiv.className = "stopped";
        }
    }

    // エントリ数の更新関数
    async function updateEntryCount() {
        try {
            const result = await chrome.storage.local.get(['vendorEntries']);
            const count = (result.vendorEntries || []).length;
            entryCountElement.textContent = `保存データ: ${count} 件`;
        } catch (error) {
            console.error('エントリ数の取得エラー:', error);
            entryCountElement.textContent = '保存データ: 読み込みエラー';
            handleExtensionError(error);
        }
    }

    // CSVパース関数
    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSVデータが不正です');
        }

        // BOMを除去
        const firstLine = lines[0].replace(/^\uFEFF/, '');
        const headers = firstLine.toLowerCase().split(',').map(h => h.trim());

        // ヘッダー正規化マッピング
        const headerMap = {
            'phonenumber': 'phoneNumber',
            'phone_number': 'phoneNumber',
            'phone': 'phoneNumber',
            'tel': 'phoneNumber',
            'vendorid': 'vendorId',
            'vendor_id': 'vendorId',
            'id': 'vendorId',
            'vendorname': 'vendorName',
            'vendor_name': 'vendorName',
            'name': 'vendorName',
            'vendorphonetic': 'vendorPhonetic',
            'vendor_phonetic': 'vendorPhonetic',
            'phonetic': 'vendorPhonetic',
            'vendorindustry': 'vendorIndustry',
            'vendor_industry': 'vendorIndustry',
            'industry': 'vendorIndustry'
        };

        const requiredHeaders = ['phonenumber', 'vendorid', 'vendorname'];
        const foundHeaders = headers.map(h => h.toLowerCase());
        
        const missingHeaders = requiredHeaders.filter(required => 
            !foundHeaders.some(found => 
                found === required || 
                Object.keys(headerMap).filter(key => headerMap[key] === headerMap[required]).includes(found)
            )
        );

        if (missingHeaders.length > 0) {
            throw new Error(`必要なヘッダーが不足しています: ${missingHeaders.join(', ')}`);
        }

        return lines.slice(1)
            .filter(line => line.trim())
            .map((line, index) => {
                const values = [];
                let inQuotes = false;
                let currentValue = '';
                
                for (let char of line) {
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(currentValue.trim());
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue.trim());

                if (values.length !== headers.length) {
                    throw new Error(`CSVの${index + 2}行目の列数が不正です`);
                }

                const entry = {};
                headers.forEach((header, index) => {
                    const normalizedHeader = headerMap[header.toLowerCase()] || header;
                    let value = values[index].replace(/^"(.*)"$/, '$1');
                    entry[normalizedHeader] = value;
                });

                if (!entry.timestamp) {
                    entry.timestamp = new Date().toISOString();
                }

                return entry;
            });
    }

function convertToCSV(data) {
    if (!data.length) return '';

    const headers = ['phoneNumber', 'vendorId', 'vendorName', 'vendorPhonetic', 'vendorIndustry', 'timestamp'];
    
    // ヘッダー行も適切にエスケープして作成
    const headerLine = headers.map(header => escapeCSVField(header)).join(',');
    const csvLines = [headerLine];

    data.forEach(entry => {
        const values = headers.map(header => {
            const value = entry[header] !== undefined && entry[header] !== null 
                ? entry[header].toString() 
                : '';
            return escapeCSVField(value);
        });
        csvLines.push(values.join(','));
    });

    // Windows環境のExcelでより確実に動作するよう \r\n を使用
    return csvLines.join('\r\n');
}

// CSVフィールドを適切にエスケープする関数
function escapeCSVField(value) {
    // 以下の条件のいずれかに該当する場合はエスケープ:
    // 1. カンマ、引用符、改行を含む
    // 2. 全角文字を含む（オプション - Excelとの互換性向上のため）
    // 3. 先頭か末尾に空白がある
    if (
        value.includes(',') || 
        value.includes('"') || 
        value.includes('\n') || 
        value.includes('\r') ||
        /^\s|\s$/.test(value) ||
        /[^\x00-\x7F]/.test(value) // 非ASCII文字（全角文字など）を検出
    ) {
        // 引用符をエスケープ ('" -> "")
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
    // エントリーの検証関数
    function validateEntries(entries) {
        if (!Array.isArray(entries)) {
            throw new Error('データが配列形式ではありません');
        }

        if (entries.length === 0) {
            throw new Error('データが空です');
        }

        const requiredFields = ['phoneNumber', 'vendorId', 'vendorName'];
        
        entries.forEach((entry, index) => {
            requiredFields.forEach(field => {
                if (!entry || !entry[field]) {
                    throw new Error(`エントリー ${index + 1} の ${field} が不足しています。\n受け取ったデータ: ${JSON.stringify(entry, null, 2)}`);
                }
            });

            // 電話番号の形式チェック
            if (!/^[\d\-]+$/.test(entry.phoneNumber)) {
                throw new Error(`エントリー ${index + 1} の電話番号形式が不正です: ${entry.phoneNumber}`);
            }

            // vendorIdの形式チェック
            if (!/^\d+$/.test(entry.vendorId)) {
                throw new Error(`エントリー ${index + 1} のvendorID形式が不正です: ${entry.vendorId}`);
            }

            // フィールドの正規化
            entry.phoneNumber = entry.phoneNumber.trim();
            entry.vendorId = entry.vendorId.trim();
            entry.vendorName = entry.vendorName.trim();
            entry.vendorPhonetic = (entry.vendorPhonetic || '').trim();
            entry.vendorIndustry = (entry.vendorIndustry || '').trim();

            if (!entry.timestamp) {
                entry.timestamp = new Date().toISOString();
            }
        });
    }

    // ファイル読み込み関数
    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    // コントロール無効化関数
    function disableAllControls() {
        downloadButton.disabled = true;
        uploadButton.disabled = true;
        rightClickToggle.disabled = true;
        operationModeToggle.disabled = true;
        toggleButton.disabled = true;
    }

    // エラーハンドリング関数
    function handleExtensionError(error) {
        if (error.message.includes('Extension context invalidated') || 
            error.message.includes('Could not establish connection')) {
            const errorMessage = document.createElement('div');
            errorMessage.textContent = '拡張機能の再読み込みが必要です。';
            errorMessage.style.color = 'red';
            errorMessage.style.marginTop = '10px';
            document.body.appendChild(errorMessage);
            
            disableAllControls();
        }
    }

    // フィードバック表示関数
    function showFeedback(button, message, isSuccess) {
        const originalContent = button.innerHTML;
        button.textContent = message;
        button.style.backgroundColor = isSuccess ? '#4CAF50' : '#f44336';

        setTimeout(() => {
            button.innerHTML = originalContent;
            button.style.backgroundColor = '';
        }, 2000);
    }

    // エラーメッセージ表示関数
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: #721c24;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 8px;
            margin: 10px 0;
            border-radius: 4px;
            font-size: 14px;
        `;

        // 既存のエラーメッセージがあれば削除
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // エラーメッセージを挿入
        statusDiv.parentNode.insertBefore(errorDiv, statusDiv.nextSibling);

        // 3秒後に自動的に消去
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
});