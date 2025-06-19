document.addEventListener('DOMContentLoaded', () => {
  const timerDisplay = document.getElementById('timer');
  const modeDisplay = document.getElementById('mode');
  const startButton = document.getElementById('start');
  const pauseButton = document.getElementById('pause');
  const stopButton = document.getElementById('stop');
  const resetButton = document.getElementById('reset');
  const workTimeInput = document.getElementById('workTime');
  const breakTimeInput = document.getElementById('breakTime');
  const volumeInput = document.getElementById('volume');
  const volumeValue = document.getElementById('volumeValue');
  const soundInput = document.getElementById('soundInput');
  const bgInput = document.getElementById('bgInput');

  let currentSound = null;
  let defaultSound = new Audio('default-sound.mp3');
  let volume = 0.5;

  // Update UI with timer state
  function updateUI(state) {
    if (!state) {
      console.error('Invalid state received:', state);
      return;
    }
    const hours = Math.floor(state.time / 3600);
    const minutes = Math.floor((state.time % 3600) / 60);
    const seconds = state.time % 60;
    timerDisplay.textContent = `${state.isWorkMode ? 'Work Time' : 'Break Time'}: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    modeDisplay.textContent = state.isWorkMode ? 'Work' : 'Break';
    pauseButton.textContent = state.isRunning ? 'Pause' : 'Resume';
    workTimeInput.value = state.workTime / 60;
    breakTimeInput.value = state.breakTime / 60;
    volumeInput.value = state.volume * 100;
    volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
    volume = state.volume;
    defaultSound.volume = volume;
    if (currentSound) currentSound.volume = volume;
    console.log('UI updated with state:', state);
  }

  // Request initial state from background
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting initial state:', chrome.runtime.lastError);
      return;
    }
    if (response && response.success) {
      updateUI(response.state);
      console.log('Initial state received:', response.state);
    } else {
      console.error('No valid state received:', response);
    }
  });

  // Listen for state updates from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateState') {
      updateUI(message.state);
    } else if (message.action === 'playSound') {
      if (currentSound) {
        currentSound.pause();
        currentSound.currentTime = 0;
      }
      currentSound = message.customSound ? new Audio(message.customSound) : defaultSound;
      currentSound.volume = message.volume;
      currentSound.loop = true; // Loop sound in popup
      currentSound.play().catch((err) => console.error('Popup sound playback failed:', err));
      console.log('Popup playing sound:', message.customSound || 'default-sound.mp3');
    }
  });

  // Send message with error handling
  function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`Error sending ${action} message:`, chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log(`${action} message sent, response:`, response);
          resolve(response);
        } else {
          console.error(`Invalid response for ${action}:`, response);
          reject(new Error('Invalid response'));
        }
      });
    });
  }

  // Start button
  startButton.addEventListener('click', () => {
    sendMessage('start').catch(() => {});
  });

  // Pause/Resume button
  pauseButton.addEventListener('click', () => {
    sendMessage(pauseButton.textContent === 'Pause' ? 'pause' : 'resume').catch(() => {});
  });

  // Stop Sound button
  stopButton.addEventListener('click', () => {
    if (currentSound) {
      currentSound.pause();
      currentSound.currentTime = 0;
      currentSound = null;
      console.log('Popup sound stopped');
    }
    sendMessage('stopSound').catch(() => {});
  });

  // Reset button
  resetButton.addEventListener('click', () => {
    sendMessage('reset').catch(() => {});
    if (currentSound) {
      currentSound.pause();
      currentSound.currentTime = 0;
      currentSound = null;
      console.log('Popup sound stopped on reset');
    }
  });

  // Work time input
  workTimeInput.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 60) {
      sendMessage('setWorkTime', { workTime: value * 60 }).catch(() => {});
    } else {
      sendMessage('getState').then((response) => {
        if (response && response.state) e.target.value = response.state.workTime / 60;
      }).catch(() => {});
    }
  });

  // Break time input
  breakTimeInput.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 60) {
      sendMessage('setBreakTime', { breakTime: value * 60 }).catch(() => {});
    } else {
      sendMessage('getState').then((response) => {
        if (response && response.state) e.target.value = response.state.breakTime / 60;
      }).catch(() => {});
    }
  });

  // Volume input
  volumeInput.addEventListener('input', (e) => {
    const value = e.target.value / 100;
    volumeValue.textContent = `${e.target.value}%`;
    volume = value;
    defaultSound.volume = value;
    if (currentSound) currentSound.volume = value;
    sendMessage('setVolume', { volume: value }).catch(() => {});
  });

  // Custom sound upload
  soundInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        sendMessage('setCustomSound', { customSound: event.target.result }).catch(() => {});
      };
      reader.readAsDataURL(file);
    }
  });

  // Custom background upload
  bgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.body.style.backgroundImage = `url(${event.target.result})`;
        chrome.storage.local.set({ customBg: event.target.result });
        console.log('Background image set:', event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // Load saved background
  chrome.storage.local.get(['customBg'], (data) => {
    if (data.customBg) {
      document.body.style.backgroundImage = `url(${data.customBg})`;
      console.log('Loaded saved background:', data.customBg);
    } else {
      document.body.style.backgroundImage = `url('default-bg.png')`;
    }
  });
});
