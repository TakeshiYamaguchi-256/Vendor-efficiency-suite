// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showImage") {
    chrome.tabs.sendMessage(sender.tab.id, {action: "displayImage"});
  }
});
chrome.runtime.onInstalled.addListener(() => {
  console.log('Integrated Keyboard Shortcuts and CSS Effects extension installed');
  chrome.storage.sync.get('effect', function(data) {
      if (!data.effect) {
          chrome.storage.sync.set({effect: 'pulse'}, function() {
              console.log('Default effect set to pulse');
          });
      }
  });
});
