const byId = id => document.getElementById(id);
const screens = ['intro', 'lab', 'mix', 'success'];
const ingredients = [
  {name:'SNOW', translation:'снег', x:2.6, y:1},
  {name:'LIGHT', translation:'свет', x:50.7, y:1},
  {name:'JOY', translation:'радость', x:98, y:1},
  {name:'KINDNESS', translation:'доброта', x:25, y:97},
  {name:'MAGIC', translation:'волшебство', x:73.5, y:97},
  {name:'СЕКРЕТ', translation:'', x:50.7, y:1}
];
const revealed = new Set();
const poured = new Set();
const note = byId('note');
const pot = byId('pot');
let dragIndex = null;
let audio;
let round = 0;

function go(screen) {
  screens.forEach(id => { byId(id).hidden = id !== screen; });
  document.querySelectorAll('.steps span').forEach((step, index) => {
    if (Math.min(screens.indexOf(screen), 2) === index) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  });
  byId(screen).querySelector('h1').focus({preventScroll:true});
  window.scrollTo(0, 0);
}

function makeJar(index, mixing) {
  const item = ingredients[index];
  const secret = index === 5;
  const jar = document.createElement('button');
  jar.type = 'button';
  jar.className = secret ? 'jar secret' : 'jar';
  jar.setAttribute('aria-label', mixing ? 'Добавить ' + item.name : 'Открыть баночку ' + (index + 1));
  const art = document.createElement('span');
  art.className = 'jar-art';
  art.style.setProperty('--x', item.x + '%');
  art.style.setProperty('--y', item.y + '%');
  jar.append(art);
  if (secret) {
    const label = document.createElement('strong');
    label.textContent = item.name;
    jar.append(label);
  }

  if (mixing) {
    jar.draggable = true;
    jar.addEventListener('click', () => pour(index));
    jar.addEventListener('dragstart', event => {
      dragIndex = index;
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.effectAllowed = 'move';
      pot.classList.add('target');
    });
    jar.addEventListener('dragend', clearDrop);
  } else {
    jar.addEventListener('click', () => {
      if (revealed.has(index)) return;
      revealed.add(index);
      jar.classList.add('revealed');
      jar.setAttribute('aria-label', item.name + ' — ' + item.translation);
      byId('lab-count').textContent = item.name + ' — ' + item.translation + ' · Найдено ' + revealed.size + ' из 5';
      byId('next').disabled = revealed.size !== 5;
    });
  }
  return jar;
}

function growl() {
  if (!audio || audio.state !== 'running') return;
  const time = audio.currentTime;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(104, time);
  tone.frequency.exponentialRampToValueAtTime(40, time + .48);
  volume.gain.setValueAtTime(.0001, time);
  volume.gain.exponentialRampToValueAtTime(.12, time + .065);
  volume.gain.exponentialRampToValueAtTime(.0001, time + .51);
  tone.connect(volume).connect(audio.destination);
  tone.start(time);
  tone.stop(time + .52);
}

function pour(index) {
  if (poured.has(index) || byId('mix').hidden) return;
  poured.add(index);
  const jar = byId('mix-jars').children[index];
  jar.disabled = true;
  jar.draggable = false;
  jar.classList.add('poured');
  byId('mix-status').textContent = 'Добавлено ' + poured.size + ' из 6';
  if (poured.size === ingredients.length) {
    const currentRound = round;
    pot.classList.add('grumble');
    growl();
    byId('mix-status').textContent = 'Кррр… Бульк… Котелок ворчит!';
    window.setTimeout(() => {
      if (currentRound !== round) return;
      byId('mix-status').textContent = 'Все 6 баночек в котелке. Чего-то не хватает…';
      byId('spell').hidden = false;
      byId('word').focus();
    }, 700);
  } else if (document.activeElement === jar || document.activeElement === document.body) {
    byId('mix-jars').querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
}

function clearDrop() {
  dragIndex = null;
  pot.classList.remove('target');
}

function makeSnow() {
  for (let index = 0; index < 78; index++) {
    const flake = document.createElement('span');
    flake.className = 'flake';
    flake.textContent = index % 3 ? '•' : '❄';
    flake.style.left = Math.random() * 100 + '%';
    flake.style.setProperty('--rest', Math.random() * 100 + '%');
    flake.style.fontSize = 8 + Math.random() * 19 + 'px';
    flake.style.opacity = .4 + Math.random() * .6;
    flake.style.animationDuration = 4 + Math.random() * 8 + 's';
    flake.style.animationDelay = -Math.random() * 10 + 's';
    byId('snow').append(flake);
  }
}

function reset() {
  round++;
  revealed.clear();
  poured.clear();
  clearDrop();
  byId('snow').replaceChildren();
  byId('lab-jars').replaceChildren(...ingredients.slice(0, 5).map((_, index) => makeJar(index, false)));
  byId('mix-jars').replaceChildren(...ingredients.map((_, index) => makeJar(index, true)));
  byId('lab-count').textContent = 'Найдено 0 из 5';
  byId('mix-status').textContent = 'Добавлено 0 из 6';
  byId('next').disabled = true;
  pot.classList.remove('grumble');
  byId('spell').hidden = true;
  byId('spell').reset();
  byId('feedback').textContent = '';
}

byId('open-note').addEventListener('click', () => note.showModal());
byId('close-note').addEventListener('click', () => note.close());
byId('start').addEventListener('click', () => { note.close(); go('lab'); });
byId('next').addEventListener('click', () => {
  if (window.AudioContext) {
    if (!audio) audio = new AudioContext();
    audio.resume().catch(() => {});
  }
  go('mix');
});
pot.addEventListener('dragover', event => {
  if (dragIndex === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
});
pot.addEventListener('drop', event => {
  event.preventDefault();
  if (dragIndex !== null) pour(dragIndex);
  clearDrop();
});
byId('spell').addEventListener('submit', event => {
  event.preventDefault();
  if (byId('word').value.trim().toLowerCase() !== 'friendship') {
    byId('feedback').textContent = 'Котелок всё ещё молчит. Попробуйте ещё раз!';
    byId('word').select();
    return;
  }
  go('success');
  makeSnow();
});
byId('restart').addEventListener('click', () => { reset(); go('intro'); });

reset();

const introLine = byId('intro-line');
const listen = byId('listen');
const line = introLine.textContent.trim();
const narration = byId('intro-audio');
const wordPieces = line.match(/\S+\s*/g);
const wordEnds = [];
let position = 0;
const animatedLine = document.createElement('span');
const layoutLine = document.createElement('span');
layoutLine.className = 'line-space';
layoutLine.setAttribute('aria-hidden', 'true');
layoutLine.textContent = line;
animatedLine.setAttribute('aria-hidden', 'true');
introLine.setAttribute('aria-label', line);

const wordSpans = wordPieces.map(piece => {
  const span = document.createElement('span');
  span.textContent = piece;
  animatedLine.append(span);
  position += piece.length;
  wordEnds.push(position);
  return span;
});
introLine.replaceChildren(layoutLine, animatedLine);
let playbackRun = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function showWords(count) {
  wordSpans.forEach((word, index) => word.classList.toggle('word-pending', index >= count));
}

function updateWords() {
  if (reducedMotion.matches || !Number.isFinite(narration.duration)) return;
  const progress = Math.min(1, narration.currentTime / narration.duration);
  const count = wordEnds.filter(end => end <= position * progress).length;
  showWords(Math.min(count + 1, wordSpans.length));
}

function stopLine() {
  playbackRun++;
  narration.pause();
  showWords(wordSpans.length);
  listen.textContent = '▶ Послушать';
  listen.setAttribute('aria-pressed', 'false');
}

narration.addEventListener('timeupdate', () => {
  if (!narration.paused) updateWords();
});
narration.addEventListener('ended', stopLine);
narration.addEventListener('error', stopLine);

listen.addEventListener('click', async () => {
  if (listen.getAttribute('aria-pressed') === 'true') {
    stopLine();
    return;
  }
  const run = ++playbackRun;
  listen.textContent = '■ Остановить';
  listen.setAttribute('aria-pressed', 'true');
  if (!reducedMotion.matches) showWords(1);

  try {
    narration.currentTime = 0;
    await narration.play();
  } catch {
    if (run === playbackRun) stopLine();
  }
});

byId('open-note').addEventListener('click', stopLine);
const discover = byId('discover');
const introBubble = byId('intro-bubble');
const openNote = byId('open-note');

function setStoryVisible(visible) {
  byId('intro').classList.toggle('splash', !visible);
  discover.hidden = visible;
  introBubble.hidden = !visible;
  openNote.hidden = !visible;
}

discover.addEventListener('click', () => {
  setStoryVisible(true);
  listen.focus({preventScroll:true});
  listen.click();
});
byId('restart').addEventListener('click', () => {
  stopLine();
  setStoryVisible(false);
});
