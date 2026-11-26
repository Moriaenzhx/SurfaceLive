'use strict';

const bookingKey = 'xiangkou-cinema:2026-11-21:reservation';
const days = Array.from(document.querySelectorAll('[data-day]'));
const filters = Array.from(document.querySelectorAll('[data-filter]'));
const screenings = Array.from(document.querySelectorAll('.screening'), (card) => ({
  card,
  id: card.dataset.id,
  day: card.closest('[data-day]'),
  title: card.querySelector('.film-title').textContent,
  time: card.querySelector('.film-meta time').textContent,
  seats: Number(card.dataset.seats),
  radio: card.querySelector('.choice'),
  capacity: card.querySelector('.seats')
}));
const dock = document.querySelector('.dock');
const dockTitle = document.querySelector('#selected-film');
const feedback = document.querySelector('[data-testid=action-feedback]');
const action = document.querySelector('[data-testid=primary-action]');
const empty = document.querySelector('#empty');

let activeDate = 'all';
let selected = screenings.find((screening) => screening.radio.checked);
let booking = readBooking();
let pageOnly = false;

function readBooking() {
  try {
    const id = localStorage.getItem(bookingKey);
    return screenings.find((screening) => screening.id === id && screening.seats > 0);
  } catch {
    return undefined;
  }
}

function render() {
  for (const filter of filters) {
    filter.setAttribute('aria-pressed', String(filter.dataset.filter === activeDate));
  }
  for (const day of days) {
    day.hidden = activeDate !== 'all' && day.dataset.day !== activeDate;
  }

  const visible = screenings.filter((screening) => !screening.day.hidden);
  const available = visible.filter((screening) => screening.seats > 0);
  if (!available.includes(selected)) {
    selected = available[0];
  }
  empty.hidden = visible.length > 0;
  const current = booking || selected;

  for (const screening of screenings) {
    const reserved = screening === booking;
    const remaining = screening.seats - Number(reserved);
    screening.radio.checked = screening === current;
    screening.radio.disabled = screening.day.hidden || Boolean(booking) || remaining === 0;
    screening.card.classList.toggle('is-booked', reserved);
    screening.capacity.classList.toggle('low', remaining > 0 && remaining <= 3);
    screening.capacity.textContent = remaining > 0 ? `余 ${remaining} 席` : '已满';
  }

  dock.classList.toggle('booked', Boolean(booking));
  dockTitle.textContent = current ? current.title : '暂无可报名场次';
  action.textContent = booking ? '已报名' : '报名此场';
  action.setAttribute('aria-disabled', String(Boolean(booking) || !current));

  let message = '可切换日期查看其他场次';
  if (booking) {
    message = pageOnly ? '报名成功 · 仅本页保留' : '报名成功 · 已预留 1 席';
  } else if (current) {
    message = `${current.day.dataset.weekday} ${current.time} · 1 位`;
  }
  if (feedback.textContent !== message) {
    feedback.textContent = message;
  }
}

for (const filter of filters) {
  filter.addEventListener('click', () => {
    activeDate = filter.dataset.filter;
    render();
  });
}

for (const screening of screenings) {
  screening.radio.addEventListener('change', () => {
    if (screening.radio.checked) {
      selected = screening;
      render();
    }
  });
}

action.addEventListener('click', () => {
  if (booking || !selected) return;

  booking = readBooking();
  if (!booking) {
    booking = selected;
    try {
      localStorage.setItem(bookingKey, booking.id);
    } catch {
      pageOnly = true;
    }
  }
  render();
});

window.addEventListener('storage', (event) => {
  if (!pageOnly && (event.key === bookingKey || event.key === null)) {
    booking = readBooking();
    render();
  }
});

render();