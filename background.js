let state = {
  workTime: 25 * 60,
  breakTime: 5 * 60,
  time: 25 * 60,
  isWorkMode: true,
  isRunning: false,
  customSound: null,
  volume: 0.5
};
let timerId = null;
let offscreenReady = false;

async function createOffscreenDocument(retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Play alert sound when Pomodoro timer ends'
        });
        offscreenReady = true;
        console.log(`Offscreen document created (attempt ${attempt})`);
        return true;
      } else {
        offscreenReady = true;
        console.log('Offscreen document already exists');
        return true;
      }
    } catch (err) {
      console.error(`Error creating offscreen document (attempt ${attempt}):`, err);
      offscreenReady = false;
      if (attempt === retries) {
        console.error('Failed to create offscreen document after retries');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function ensureOffscreenDocument() {
  if (!offscreenReady) {
    return await createOffscreenDocument();
  }
  return offscreenReady;
}

function updateBadge() {
  try {
    if (state.isRunning && state.time > 0) {
      const minutes = Math.floor(state.time / 60);
      const seconds = state.time % 60;
      const badgeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: state.isWorkMode ? '#4CAF50' : '#2196F3' });
      console.log('Badge updated:', badgeText);
    } else {
      chrome.action.setBadgeText({ text: '' });
      console.log('Badge cleared');
    }
  } catch (err) {
    console.error('Error updating badge:', err);
  }
}

function updateTimer() {
  try {
    if (state.isRunning && state.time > 0) {
      state.time--;
      console.log('Timer tick, time:', state.time);
      chrome.runtime.sendMessage({ action: 'updateState', state });
      updateBadge();
    } else if (state.time <= 0) {
      clearInterval(timerId);
      timerId = null;
      state.isRunning = false;
      updateBadge();
      ensureOffscreenDocument().then((success) => {
        if (success) {
          chrome.runtime.sendMessage({
            action: 'playSound',
            customSound: state.customSound,
            volume: state.volume
          });
          console.log('Sent playSound message, sound:', state.customSound || 'default-sound.mp3');
        } else {
          console.error('Cannot play sound: offscreen document unavailable');
        }
      });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Pomodoro Timer',
        message: state.isWorkMode ? 'Work session complete! Time for a break.' : 'Break time is up! Back to work.'
      });
      // Switch mode
      state.isWorkMode = !state.isWorkMode;
      state.time = state.isWorkMode ? state.workTime : state.breakTime;
      // Auto-start next session
      state.isRunning = true;
      timerId = setInterval(updateTimer, 1000);
      console.log('New session started, mode:', state.isWorkMode ? 'Work' : 'Break', 'time:', state.time);
      chrome.runtime.sendMessage({ action: 'updateState', state });
      updateBadge();
    }
  } catch (err) {
    console.error('Error in updateTimer:', err);
  }
}

function saveState() {
  try {
    chrome.storage.local.set({
      workTime: state.workTime / 60,
      breakTime: state.breakTime / 60,
      volume: state.volume,
      customSound: state.customSound
    });
    console.log('State saved:', state);
  } catch (err) {
    console.error('Error saving state:', err);
  }
}

// Load saved settings
chrome.storage.local.get(['workTime', 'breakTime', 'volume', 'customSound'], (data) => {
  try {
    if (data.workTime) state.workTime = data.workTime * 60;
    if (data.breakTime) state.breakTime = data.breakTime * 60;
    if (data.volume) state.volume = data.volume;
    if (data.customSound) state.customSound = data.customSound;
    state.time = state.isWorkMode ? state.workTime : state.breakTime;
    console.log('Loaded saved settings:', data);
    chrome.runtime.sendMessage({ action: 'updateState', state });
    updateBadge();
  } catch (err) {
    console.error('Error loading settings:', err);
  }
});

// Create offscreen document on startup
createOffscreenDocument();

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Message received:', message);
    switch (message.action) {
      case 'getState':
        sendResponse({ success: true, state });
        console.log('Sent state:', state);
        break;
      case 'start':
        if (!state.isRunning) {
          state.isRunning = true;
          state.time = state.isWorkMode ? state.workTime : state.breakTime;
          if (!timerId) {
            timerId = setInterval(updateTimer, 1000);
            console.log('Timer started, timerId:', timerId);
          }
          chrome.runtime.sendMessage({ action: 'updateState', state });
          updateBadge();
        }
        sendResponse({ success: true });
        break;
      case 'pause':
        if (state.isRunning) {
          state.isRunning = false;
          clearInterval(timerId);
          timerId = null;
          chrome.runtime.sendMessage({ action: 'updateState', state });
          updateBadge();
          console.log('Timer paused');
        }
        sendResponse({ success: true });
        break;
      case 'resume':
        if (!state.isRunning) {
          state.isRunning = true;
          if (!timerId) {
            timerId = setInterval(updateTimer, 1000);
            console.log('Timer resumed, timerId:', timerId);
          }
          chrome.runtime.sendMessage({ action: 'updateState', state });
          updateBadge();
        }
        sendResponse({ success: true });
        break;
      case 'stopSound':
        ensureOffscreenDocument().then((success) => {
          if (success) {
            chrome.runtime.sendMessage({ action: 'stopSound' });
            console.log('Sent stopSound message');
          } else {
            console.error('Cannot stop sound: offscreen document unavailable');
          }
          sendResponse({ success });
        });
        return true; // Async response
      case 'reset':
        clearInterval(timerId);
        timerId = null;
        state.isRunning = false;
        state.isWorkMode = true;
        state.workTime = 25 * 60;
        state.breakTime = 5 * 60;
        state.time = state.workTime;
        state.customSound = null;
        chrome.storage.local.set({ workTime: 25, breakTime: 5 });
        chrome.storage.local.remove('customSound');
        saveState();
        ensureOffscreenDocument().then((success) => {
          if (success) {
            chrome.runtime.sendMessage({ action: 'stopSound' });
            console.log('Sent stopSound message on reset');
          }
          chrome.runtime.sendMessage({ action: 'updateState', state });
          updateBadge();
          sendResponse({ success });
        });
        return true; // Async response
      case 'setWorkTime':
        state.workTime = message.workTime;
        if (state.isWorkMode) state.time = state.workTime;
        saveState();
        chrome.runtime.sendMessage({ action: 'updateState', state });
        updateBadge();
        console.log('Work time set:', state.workTime);
        sendResponse({ success: true });
        break;
      case 'setBreakTime':
        state.breakTime = message.breakTime;
        if (!state.isWorkMode) state.time = state.breakTime;
        saveState();
        chrome.runtime.sendMessage({ action: 'updateState', state });
        updateBadge();
        console.log('Break time set:', state.breakTime);
        sendResponse({ success: true });
        break;
      case 'setVolume':
        state.volume = message.volume;
        saveState();
        chrome.runtime.sendMessage({ action: 'updateState', state });
        console.log('Volume set:', state.volume);
        sendResponse({ success: true });
        break;
      case 'setCustomSound':
        state.customSound = message.customSound;
        saveState();
        console.log('Custom sound set:', state.customSound);
        sendResponse({ success: true });
        break;
      default:
        console.warn('Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    console.error('Error handling message:', message, err);
    sendResponse({ success: false, error: err.message });
  }
});