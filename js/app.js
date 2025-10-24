const JAKARTA_OFFSET_MINUTES = 7 * 60;
const JAKARTA_OFFSET_MS = JAKARTA_OFFSET_MINUTES * 60 * 1000;
const STORAGE_KEY = 'bangal-realtime-age:dob';
const DEFAULT_DOB = jakartaDate(1995, 8, 19, 0, 0, 0);

const elements = {
  input: document.getElementById('dob-input'),
  setButton: document.getElementById('set-dob'),
  resetButton: document.getElementById('reset-dob'),
  age: {
    years: document.querySelector('[data-age="years"]'),
    days: document.querySelector('[data-age="days"]'),
    hours: document.querySelector('[data-age="hours"]'),
    minutes: document.querySelector('[data-age="minutes"]'),
    seconds: document.querySelector('[data-age="seconds"]'),
  },
  ageStatus: document.getElementById('age-status'),
  countdown: {
    days: document.querySelector('[data-count="days"]'),
    hours: document.querySelector('[data-count="hours"]'),
    minutes: document.querySelector('[data-count="minutes"]'),
    seconds: document.querySelector('[data-count="seconds"]'),
  },
  progressBar: document.getElementById('progress-bar'),
  badge: document.getElementById('birthday-badge'),
  nowTime: document.getElementById('now-time'),
  progressWrapper: document.querySelector('.progress-wrapper'),
};

let currentDob = DEFAULT_DOB;
let tickerId = null;
let lastTick = performance.now();
let badgeTimeout = null;

function jakartaDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utc - JAKARTA_OFFSET_MS);
}

function toJakarta(date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

function parseDobFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const dobString = params.get('dob');
  if (!dobString) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobString);
  if (!match) return null;
  const [_, y, m, d] = match;
  const parsed = jakartaDate(Number(y), Number(m), Number(d));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseDobFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(stored);
    if (!match) return null;
    const [_, y, m, d, hh, mm] = match;
    const parsed = jakartaDate(Number(y), Number(m), Number(d), Number(hh), Number(mm));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (error) {
    console.warn('Gagal membaca tanggal lahir dari localStorage', error);
    return null;
  }
}

function storeDob(date) {
  const dobLocal = toJakarta(date);
  const value = [
    dobLocal.getUTCFullYear(),
    String(dobLocal.getUTCMonth() + 1).padStart(2, '0'),
    String(dobLocal.getUTCDate()).padStart(2, '0'),
  ].join('-') +
    'T' +
    [
      String(dobLocal.getUTCHours()).padStart(2, '0'),
      String(dobLocal.getUTCMinutes()).padStart(2, '0'),
    ].join(':');
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    console.warn('Gagal menyimpan tanggal lahir', error);
  }
}

function jakartaNow() {
  return new Date(Date.now());
}

function getDobComponents(date) {
  const local = toJakarta(date);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

function getNextBirthday(dob, now = jakartaNow()) {
  const base = getDobComponents(dob);
  const nowLocal = toJakarta(now);
  let year = nowLocal.getUTCFullYear();
  let candidate = jakartaDate(year, base.month, base.day, base.hour, base.minute, base.second);
  if (candidate.getTime() <= now.getTime()) {
    candidate = jakartaDate(year + 1, base.month, base.day, base.hour, base.minute, base.second);
  }
  return candidate;
}

function getLastBirthday(dob, now = jakartaNow()) {
  const base = getDobComponents(dob);
  const nowLocal = toJakarta(now);
  let year = nowLocal.getUTCFullYear();
  let candidate = jakartaDate(year, base.month, base.day, base.hour, base.minute, base.second);
  if (candidate.getTime() > now.getTime()) {
    candidate = jakartaDate(year - 1, base.month, base.day, base.hour, base.minute, base.second);
  }
  return candidate;
}

function diffHMS(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  return { days, hours, mins: minutes, secs: seconds };
}

function diffAgeComponents(dob, now = jakartaNow()) {
  if (now.getTime() < dob.getTime()) {
    return {
      years: 0,
      days: 0,
      hours: 0,
      mins: 0,
      secs: 0,
      forward: false,
      until: diffHMS(dob.getTime() - now.getTime()),
    };
  }

  const base = getDobComponents(dob);
  const nowLocal = toJakarta(now);
  let years = nowLocal.getUTCFullYear() - base.year;
  const thisYearBirthday = jakartaDate(nowLocal.getUTCFullYear(), base.month, base.day, base.hour, base.minute, base.second);
  let last = thisYearBirthday;
  if (now.getTime() < thisYearBirthday.getTime()) {
    years -= 1;
    last = jakartaDate(nowLocal.getUTCFullYear() - 1, base.month, base.day, base.hour, base.minute, base.second);
  }

  const diff = diffHMS(now.getTime() - last.getTime());
  return {
    years,
    days: diff.days,
    hours: diff.hours,
    mins: diff.mins,
    secs: diff.secs,
    forward: true,
  };
}

function updateInputValue(date) {
  const local = toJakarta(date);
  const value = [
    local.getUTCFullYear(),
    String(local.getUTCMonth() + 1).padStart(2, '0'),
    String(local.getUTCDate()).padStart(2, '0'),
  ].join('-') +
    'T' +
    [
      String(local.getUTCHours()).padStart(2, '0'),
      String(local.getUTCMinutes()).padStart(2, '0'),
    ].join(':');
  elements.input.value = value;
}

function setDob(newDob) {
  if (Number.isNaN(newDob.getTime())) return;
  currentDob = newDob;
  updateInputValue(currentDob);
  storeDob(currentDob);
  render();
}

function resetDob() {
  currentDob = DEFAULT_DOB;
  updateInputValue(currentDob);
  storeDob(currentDob);
  render();
}

function render() {
  const now = jakartaNow();
  const age = diffAgeComponents(currentDob, now);

  let nextBirthday = getNextBirthday(currentDob, now);
  let lastBirthday = getLastBirthday(currentDob, now);

  if (!age.forward) {
    elements.age.years.textContent = '0';
    elements.age.days.textContent = '0';
    elements.age.hours.textContent = '00';
    elements.age.minutes.textContent = '00';
    elements.age.seconds.textContent = '00';
    elements.ageStatus.textContent = 'Belum lahir';

    const untilBirth = diffHMS(currentDob.getTime() - now.getTime());
    elements.countdown.days.textContent = String(untilBirth.days);
    elements.countdown.hours.textContent = String(untilBirth.hours).padStart(2, '0');
    elements.countdown.minutes.textContent = String(untilBirth.mins).padStart(2, '0');
    elements.countdown.seconds.textContent = String(untilBirth.secs).padStart(2, '0');
    elements.progressBar.style.width = '0%';
    elements.progressWrapper.setAttribute('aria-valuenow', '0');
    if (badgeTimeout) {
      clearTimeout(badgeTimeout);
      badgeTimeout = null;
    }
    elements.badge.hidden = true;
    nextBirthday = currentDob;
    lastBirthday = currentDob;
  } else {
    elements.age.years.textContent = String(age.years);
    elements.age.days.textContent = String(age.days);
    elements.age.hours.textContent = String(age.hours).padStart(2, '0');
    elements.age.minutes.textContent = String(age.mins).padStart(2, '0');
    elements.age.seconds.textContent = String(age.secs).padStart(2, '0');
    elements.ageStatus.textContent = '';

    const remaining = diffHMS(nextBirthday.getTime() - now.getTime());
    elements.countdown.days.textContent = String(remaining.days);
    elements.countdown.hours.textContent = String(remaining.hours).padStart(2, '0');
    elements.countdown.minutes.textContent = String(remaining.mins).padStart(2, '0');
    elements.countdown.seconds.textContent = String(remaining.secs).padStart(2, '0');

    const totalWindow = nextBirthday.getTime() - lastBirthday.getTime();
    const elapsedWindow = now.getTime() - lastBirthday.getTime();
    const pct = totalWindow > 0 ? Math.min(100, Math.max(0, (elapsedWindow / totalWindow) * 100)) : 100;
    elements.progressBar.style.width = `${pct}%`;
    elements.progressWrapper.setAttribute('aria-valuenow', pct.toFixed(2));

    const diffMillis = nextBirthday.getTime() - now.getTime();
    if (diffMillis <= 0 && diffMillis > -1000) {
      if (badgeTimeout) {
        clearTimeout(badgeTimeout);
      }
      elements.badge.hidden = false;
      badgeTimeout = setTimeout(() => {
        elements.badge.hidden = true;
        badgeTimeout = null;
      }, 2500);
    } else if (diffMillis > 0 && !elements.badge.hidden && !badgeTimeout) {
      elements.badge.hidden = true;
    }
  }

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  elements.nowTime.textContent = formatter.format(now);
}

function handleSetClick() {
  if (!elements.input.value) return;
  const [datePart, timePart] = elements.input.value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = '00', minute = '00'] = (timePart || '00:00').split(':');
  const newDob = jakartaDate(Number(year), Number(month), Number(day), Number(hour), Number(minute));
  setDob(newDob);
}

function initDob() {
  const queryDob = parseDobFromQuery();
  if (queryDob) {
    currentDob = queryDob;
  } else {
    const storedDob = parseDobFromStorage();
    if (storedDob) {
      currentDob = storedDob;
    }
  }
  updateInputValue(currentDob);
  storeDob(currentDob);
}

function startTicker() {
  if (tickerId) {
    clearInterval(tickerId);
  }
  lastTick = performance.now();
  render();
  tickerId = setInterval(() => {
    const nowTick = performance.now();
    const drift = nowTick - lastTick - 1000;
    lastTick = nowTick;
    render();
    if (Math.abs(drift) > 16) {
      clearInterval(tickerId);
      startTicker();
    }
  }, 1000);
}

function bindEvents() {
  elements.setButton.addEventListener('click', handleSetClick);
  elements.resetButton.addEventListener('click', () => resetDob());
  elements.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSetClick();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDob();
  bindEvents();
  startTicker();
});
