// Inlined in content/main.tsx too: a shared module would split the content
// script into a chunk, and CRXJS would then load it asynchronously.
const RESTORE_NATIVE_FONTS_MESSAGE = 'sep-plus:restore-native-fonts';

/**
 * The static ruleset blocks Font Awesome because SEP+ hides the chrome that
 * uses it. If SEP+ fails to start in a tab, native SEP needs it back.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (message?.type !== RESTORE_NATIVE_FONTS_MESSAGE || tabId === undefined) {
    return false;
  }
  chrome.declarativeNetRequest
    .updateSessionRules({
      removeRuleIds: [tabId],
      addRules: [
        {
          id: tabId,
          priority: 2,
          action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
          condition: {
            tabIds: [tabId],
            requestDomains: ['plato.stanford.edu'],
            urlFilter: 'font-awesome',
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.STYLESHEET,
            ],
          },
        },
      ],
    })
    .then(
      () => sendResponse(true),
      () => sendResponse(false),
    );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [tabId] })
    .catch(() => undefined);
});
