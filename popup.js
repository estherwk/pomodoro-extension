let workTime = 25 * 60;
let breakTime = 5 * 60;
let time = workTime;
let isWorkMode = true;
let timerId = null;
let customSound = null;
let defaultSound = new Audio('default-sound.mp3');
let volume = 0.5;

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

  // Load saved settings
  chrome.storage.local.get(['customSound', 'customBg', 'workTime', 'breakTime', 'volume'], (data) => {
    if (data.customBg) {
      document.body.style.backgroundImage = `url(${data.customBg})`;
    } else {
      document.body.style.backgroundImage = `url('default-bg.png')`;
    }
    if (data.customSound) {
      customSound = new Audio(data.customSound);
      customSound.volume = data.volume || 0.5;
    }
    defaultSound.volume = data.volume || 0.5;
    if (data.workTime) {
      workTime = data.workTime * 60;
      workTimeInput.value = data.workTime;
      if (isWorkMode) time = workTime;
    }
    if (data.breakTime) {
      breakTime = data.breakTime * 60;
      breakTimeInput.value = data.breakTime;
      if (!isWorkMode) time = breakTime;
    }
    if (data.volume) {
      volume = data.volume;
      volumeInput.value = data.volume * 100;
      volumeValue.textContent = `${Math.round(data.volume * 100)}%`;
    }
    updateTimerDisplay();
  });

  // Update timer display
  function updateTimerDisplay() {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = time % 60;
    timerDisplay.textContent = `${isWorkMode ? 'Work Time' : 'Break Time'}: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    modeDisplay.textContent = isWorkMode ? 'Work' : 'Break';
  }

  // Timer logic
  function updateTimer() {
    if (time > 0) {
      time--;
      updateTimerDisplay();
    } else {
      clearInterval(timerId);
      timerId = null;
      startButton.textContent = 'Start';
      (customSound || defaultSound).play();
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Pomodoro Timer',
        message: isWorkMode ? 'Work session complete! Time for a break.' : 'Break time is up! Back to work.'
      });
      // Switch mode
      isWorkMode = !isWorkMode;
      time = isWorkMode ? workTime : breakTime;
      updateTimerDisplay();
      // Auto-start next session
      timerId = setInterval(updateTimer, 1000);
      startButton.textContent = 'Start';
      pauseButton.textContent = 'Pause';
    }
  }

  // Start button
  startButton.addEventListener('click', () => {
    if (!timerId) {
      timerId = setInterval(updateTimer, 1000);
      startButton.textContent = 'Start';
      pauseButton.textContent = 'Pause';
    }
  });

  // Pause button
  pauseButton.addEventListener('click', () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      pauseButton.textContent = 'Resume';
    } else if (pauseButton.textContent === 'Resume') {
      timerId = setInterval(updateTimer, 1000);
      pauseButton.textContent = 'Pause';
    }
  });

  // Stop button
  stopButton.addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    isWorkMode = true;
    time = workTime;
    updateTimerDisplay();
    startButton.textContent = 'Start';
    pauseButton.textContent = 'Pause';
  });

  // Reset button
  resetButton.addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    isWorkMode = true;
    workTime = 25 * 60; // Reset to default 25 minutes
    breakTime = 5 * 60; // Reset to default 5 minutes
    time = workTime;
    customSound = null; // Reset to default sound
    document.body.style.backgroundImage = `url('default-bg.png')`; // Reset to default background
    workTimeInput.value = 25;
    breakTimeInput.value = 5;
    chrome.storage.local.set({ workTime: 25, breakTime: 5 });
    chrome.storage.local.remove(['customSound', 'customBg']);
    defaultSound.volume = volume;
    updateTimerDisplay();
    startButton.textContent = 'Start';
    pauseButton.textContent = 'Pause';
  });

  // Work time input
  workTimeInput.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 60) {
      workTime = value * 60;
      chrome.storage.local.set({ workTime: value });
      if (isWorkMode) {
        time = workTime;
        updateTimerDisplay();
      }
    } else {
      e.target.value = workTime / 60;
    }
  });

  // Break time input
  breakTimeInput.addEventListener('change', (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 60) {
      breakTime = value * 60;
      chrome.storage.local.set({ breakTime: value });
      if (!isWorkMode) {
        time = breakTime;
        updateTimerDisplay();
      }
    } else {
      e.target.value = breakTime / 60;
    }
  });

  // Volume input
  volumeInput.addEventListener('input', (e) => {
    volume = e.target.value / 100;
    volumeValue.textContent = `${e.target.value}%`;
    if (customSound) customSound.volume = volume;
    defaultSound.volume = volume;
    chrome.storage.local.set({ volume: volume });
  });

  // Custom sound upload
  soundInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        customSound = new Audio(event.target.result);
        customSound.volume = volume;
        chrome.storage.local.set({ customSound: event.target.result });
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
      };
      reader.readAsDataURL(file);
    }
  });
});
