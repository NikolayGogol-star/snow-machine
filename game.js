const byId = id => document.getElementById(id);
const magicWord = 'friendship';
const screens = ['intro', 'lab', 'mix', 'success'];
const ingredients = [
  {name:'SNOW', translation:'снег', x:2.6, y:1},
  {name:'LIGHT', translation:'свет', x:50.7, y:1},
  {name:'JOY', translation:'радость', x:98, y:1},
  {name:'KINDNESS', translation:'доброта', x:25, y:97},
  {name:'MAGIC', translation:'волшебство', x:73.5, y:97}
];
const revealed = new Set();
const poured = new Set();
const note = byId('note');
const noteSound = byId('note-sound');
const pot = byId('pot');
const ingredientSound = byId('ingredient-sound');
const failedSound = byId('cauldron-failed');
const finaleTrack = byId('finale-track');
const introMusic = byId('intro-music');
const labMusic = byId('lab-music');
const machineStart = byId('machine-start');
let dragIndex = null;
let audio;
let musicGain;
let effectsGain;
let cauldronBuffer;
let cauldronSource;
let musicEnabled = true;
let voicePlaying = false;
let finalMusic = false;
let finaleTrackActive = false;
let sceneMusic = introMusic;
let nextBeatAt = 0;
let beat = 0;
const soundtrack = [
  [62, 69, 74, 77, 76, 74, 69, 77],
  [58, 65, 70, 74, 72, 70, 65, 74],
  [65, 72, 77, 81, 79, 77, 72, 81],
  [60, 67, 72, 76, 74, 72, 67, 76]
];
const finaleMelody = [
  [65, 72, 77, 81, 84, 81, 79, 77],
  [67, 74, 79, 82, 86, 82, 81, 79],
  [70, 77, 82, 86, 89, 86, 84, 82],
  [60, 67, 76, 79, 84, 79, 77, 76]
];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
let round = 0;

function go(screen) {
  if (screen !== 'mix') {
    stopCauldronLoop();
    failedSound.pause();
  }
  finalMusic = screen === 'success';
  selectSceneMusic(screen);
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
  const jar = document.createElement('button');
  jar.type = 'button';
  jar.className = 'jar';
  jar.setAttribute('aria-label', mixing ? 'Добавить ' + item.name : 'Открыть баночку ' + (index + 1));
  const art = document.createElement('span');
  art.className = 'jar-art';
  art.style.setProperty('--x', item.x + '%');
  art.style.setProperty('--y', item.y + '%');
  jar.append(art);

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
      ringIngredient(index);
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

function sound(bus, frequency, endFrequency, time, length, peak, type = 'sine') {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + length);
  envelope.gain.setValueAtTime(.0001, time);
  envelope.gain.exponentialRampToValueAtTime(peak, time + Math.min(.024, length / 4));
  envelope.gain.exponentialRampToValueAtTime(.0001, time + length);
  oscillator.connect(envelope).connect(bus);
  oscillator.start(time);
  oscillator.stop(time + length + .01);
}

function scheduleMusic() {
  if (audio.state !== 'running') return;
  nextBeatAt = Math.max(nextBeatAt, audio.currentTime + .02);
  while (nextBeatAt < audio.currentTime + .23) {
    const melody = finalMusic ? finaleMelody : soundtrack;
    const step = beat % 8;
    const pitch = hz(melody[Math.floor(beat / 8) % melody.length][step]);
    sound(musicGain, pitch, pitch, nextBeatAt, .85, step === 0 ? .045 : .064);
    sound(musicGain, pitch * 2, pitch * 2, nextBeatAt, .31, .017);
    if (step === 0) sound(musicGain, pitch / 2, pitch / 2, nextBeatAt, 2.1, .052, 'triangle');
    beat++;
    nextBeatAt += finalMusic ? .31 : .44;
  }
}

function updateSoundLevels() {
  introMusic.volume = voicePlaying ? .09 : .31;
  labMusic.volume = .32;
  machineStart.volume = .62;
  failedSound.volume = .65;
  finaleTrack.volume = machineStart.paused ? .55 : .17;
  [introMusic, labMusic, machineStart, finaleTrack, ingredientSound, failedSound, noteSound].forEach(track => {
    track.muted = !musicEnabled;
  });
  if (!audio) return;
  const time = audio.currentTime;
  musicGain.gain.setTargetAtTime(musicEnabled && !finaleTrackActive && !cauldronSource && (!sceneMusic || sceneMusic.paused) ? (voicePlaying ? .16 : .64) : 0, time, .1);
  effectsGain.gain.setTargetAtTime(musicEnabled ? .75 : 0, time, .04);
}

function selectSceneMusic(screen) {
  const nextMusic = screen === 'intro' ? introMusic : screen === 'lab' ? labMusic : null;
  if (sceneMusic !== nextMusic && sceneMusic) {
    sceneMusic.pause();
    sceneMusic.currentTime = 0;
  }
  sceneMusic = nextMusic;
  if (sceneMusic) playSceneMusic();
  updateSoundLevels();
}

function playSceneMusic() {
  if (sceneMusic) sceneMusic.play().catch(updateSoundLevels);
}

introMusic.addEventListener('playing', updateSoundLevels);
labMusic.addEventListener('playing', updateSoundLevels);
machineStart.addEventListener('playing', updateSoundLevels);
machineStart.addEventListener('ended', updateSoundLevels);
machineStart.addEventListener('error', updateSoundLevels);

function startSound() {
  playSceneMusic();
  if (!window.AudioContext) {
    updateSoundLevels();
    return;
  }
  if (!audio) {
    audio = new AudioContext();
    musicGain = audio.createGain();
    effectsGain = audio.createGain();
    musicGain.gain.value = 0;
    effectsGain.gain.value = 0;
    musicGain.connect(audio.destination);
    effectsGain.connect(audio.destination);
    updateSoundLevels();
    window.setInterval(scheduleMusic, 90);
    cauldronBuffer = fetch('cauldron-loop.wav')
      .then(response => {
        if (!response.ok) throw new Error('Cauldron audio unavailable');
        return response.arrayBuffer();
      })
      .then(bytes => audio.decodeAudioData(bytes))
      .catch(() => null);
  }
  audio.resume().then(scheduleMusic).catch(() => {});
}

function ringIngredient(index) {
  if (!musicEnabled || audio?.state !== 'running') return;
  const time = audio.currentTime;
  const pitch = hz([76, 79, 81, 84, 86][index]);
  sound(effectsGain, pitch, pitch, time, .27, .14);
  sound(effectsGain, pitch * 1.5, pitch * 1.5, time + .07, .32, .095);
  sound(effectsGain, pitch * 2, pitch * 2, time + .14, .36, .045);
}

function splash() {
  if (!musicEnabled) return;
  ingredientSound.volume = .7;
  ingredientSound.currentTime = 0;
  ingredientSound.play().catch(() => {});
}

async function startCauldronLoop() {
  const currentRound = round;
  const buffer = await cauldronBuffer;
  if (!buffer || currentRound !== round || byId('mix').hidden || cauldronSource) return;
  cauldronSource = audio.createBufferSource();
  const volume = audio.createGain();
  volume.gain.value = .33;
  cauldronSource.buffer = buffer;
  cauldronSource.loop = true;
  cauldronSource.connect(volume).connect(effectsGain);
  cauldronSource.start();
  updateSoundLevels();
}

function stopCauldronLoop() {
  if (!cauldronSource) return;
  cauldronSource.stop();
  cauldronSource = null;
}

function playFailedSound() {
  if (!musicEnabled) return;
  failedSound.currentTime = 0;
  failedSound.play().catch(() => {});
}

function celebrationChime() {
  if (audio?.state !== 'running' || !musicEnabled) return;
  [72, 76, 79, 84].forEach((note, index) => {
    const pitch = hz(note);
    sound(effectsGain, pitch, pitch, audio.currentTime + index * .12, .65, .085);
  });
}

function stopFinaleTrack() {
  finaleTrackActive = false;
  finaleTrack.pause();
  machineStart.pause();
  updateSoundLevels();
}

function playFinaleTrack() {
  finaleTrackActive = true;
  finaleTrack.currentTime = 0;
  machineStart.currentTime = 0;
  machineStart.play().catch(updateSoundLevels);
  updateSoundLevels();
  finaleTrack.play().catch(() => {
    if (!finaleTrackActive) return;
    stopFinaleTrack();
    celebrationChime();
  });
}

finaleTrack.addEventListener('ended', stopFinaleTrack);

const soundToggle = byId('sound-toggle');
soundToggle.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  soundToggle.setAttribute('aria-pressed', String(musicEnabled));
  if (musicEnabled) startSound();
  updateSoundLevels();
});

function pour(index) {
  if (poured.has(index) || byId('mix').hidden) return;
  poured.add(index);
  splash();
  const jar = byId('mix-jars').children[index];
  jar.disabled = true;
  jar.draggable = false;
  jar.classList.add('poured');
  byId('mix-status').textContent = 'Добавлено ' + poured.size + ' из ' + ingredients.length;
  if (poured.size === ingredients.length) {
    const currentRound = round;
    pot.classList.add('grumble');
    playFailedSound();
    byId('mix-status').textContent = 'Кррр… Бульк… Котелок ворчит!';
    window.setTimeout(() => {
      if (currentRound !== round) return;
      byId('mix-status').textContent = 'Все баночки в котелке. Чего-то не хватает…';
      byId('spell').hidden = false;
      letterFields[0].focus();
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
  ingredientSound.pause();
  round++;
  revealed.clear();
  poured.clear();
  clearDrop();
  byId('snow').replaceChildren();
  byId('lab-jars').replaceChildren(...ingredients.map((_, index) => makeJar(index, false)));
  byId('mix-jars').replaceChildren(...ingredients.map((_, index) => makeJar(index, true)));
  byId('lab-count').textContent = 'Найдено 0 из 5';
  byId('mix-status').textContent = 'Добавлено 0 из ' + ingredients.length;
  byId('next').disabled = true;
  pot.classList.remove('grumble');
  byId('spell').hidden = true;
  byId('spell').reset();
  byId('feedback').textContent = '';
}

byId('close-note').addEventListener('click', () => note.close());
byId('start').addEventListener('click', () => { note.close(); go('lab'); });
byId('next').addEventListener('click', () => {
  startSound();
  go('mix');
  startCauldronLoop();
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
const letters = byId('letters');
const letterFields = Array.from(magicWord, (_, index) => {
  const field = document.createElement('input');
  field.type = 'text';
  field.lang = 'en';
  field.autocomplete = 'off';
  field.autocapitalize = 'none';
  field.spellcheck = false;
  field.maxLength = 1;
  field.setAttribute('aria-label', 'Буква ' + (index + 1));
  field.addEventListener('focus', () => field.select());
  field.addEventListener('input', () => {
    field.value = field.value.toLowerCase().replace(/[^a-z]/g, '');
    byId('feedback').textContent = '';
    if (field.value) letterFields[index + 1]?.focus();
  });
  field.addEventListener('keydown', event => {
    if (event.key === 'Backspace' && !field.value && index > 0) {
      event.preventDefault();
      letterFields[index - 1].value = '';
      letterFields[index - 1].focus();
    }
  });
  field.addEventListener('paste', event => {
    const text = event.clipboardData.getData('text').toLowerCase().replace(/[^a-z]/g, '');
    event.preventDefault();
    if (!text) return;
    const start = text.length >= magicWord.length ? 0 : index;
    const pasted = text.slice(0, magicWord.length - start);
    [...pasted].forEach((letter, offset) => { letterFields[start + offset].value = letter; });
    letterFields[Math.min(start + pasted.length, magicWord.length - 1)].focus();
    byId('feedback').textContent = '';
  });
  letters.append(field);
  return field;
});

byId('spell').addEventListener('submit', event => {
  event.preventDefault();
  const empty = letterFields.find(field => !field.value);
  if (empty) {
    byId('feedback').textContent = 'Заполните все квадратики.';
    empty.focus();
    return;
  }
  if (letterFields.map(field => field.value).join('') !== magicWord) {
    byId('feedback').textContent = 'Котелок всё ещё молчит. Попробуйте ещё раз!';
    letterFields[0].focus();
    return;
  }
  go('success');
  playFinaleTrack();
  makeSnow();
});
byId('restart').addEventListener('click', () => { reset(); go('intro'); });

reset();

const introLine = byId('intro-line');
const listen = byId('listen');
const line = introLine.textContent.trim();
const narration = byId('intro-audio');
const wordPieces = line.match(/\S+\s*/g);
// Word starts in govorusha-voice.m4a, in display order. «Учёный-эльф» is one displayed word.
const wordStarts = [
  1.84, 3.08, 3.86, 4.54, 5.14, 5.92, 6.68,
  8.26, 8.70, 9.34, 10.66, 10.70, 11.16, 12.00, 13.46, 14.16, 14.44, 15.52
];
const animatedLine = document.createElement('span');
const layoutLine = document.createElement('span');
layoutLine.className = 'line-space';
layoutLine.setAttribute('aria-hidden', 'true');
layoutLine.textContent = line;
animatedLine.setAttribute('aria-hidden', 'true');
introLine.setAttribute('aria-label', line);

const wordSpans = wordPieces.map(piece => {
  const span = document.createElement('span');
  span.className = 'intro-word';
  span.textContent = piece;
  animatedLine.append(span);
  return span;
});
introLine.replaceChildren(layoutLine, animatedLine);
let playbackRun = 0;
let wordFrame = 0;
let visibleWords = wordSpans.length;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function showWords(count) {
  if (visibleWords === count) return;
  visibleWords = count;
  wordSpans.forEach((word, index) => word.classList.toggle('word-pending', index >= count));
}

function updateWords() {
  const time = narration.currentTime;
  const nextWord = wordStarts.findIndex(start => start > time);
  showWords(nextWord < 0 ? wordSpans.length : nextWord);
}

function animateWords() {
  if (narration.paused || reducedMotion.matches) return;
  updateWords();
  wordFrame = window.requestAnimationFrame(animateWords);
}

function stopLine() {
  voicePlaying = false;
  updateSoundLevels();
  playbackRun++;
  window.cancelAnimationFrame(wordFrame);
  narration.pause();
  showWords(wordSpans.length);
  listen.textContent = '▶ Послушать';
  listen.setAttribute('aria-pressed', 'false');
}

narration.addEventListener('playing', () => {
  window.cancelAnimationFrame(wordFrame);
  animateWords();
});
narration.addEventListener('ended', stopLine);
narration.addEventListener('error', stopLine);

listen.addEventListener('click', async () => {
  if (listen.getAttribute('aria-pressed') === 'true') {
    stopLine();
    return;
  }
  const run = ++playbackRun;
  voicePlaying = true;
  updateSoundLevels();
  listen.textContent = '■ Остановить';
  listen.setAttribute('aria-pressed', 'true');
  if (!reducedMotion.matches) showWords(0);

  try {
    narration.currentTime = 0;
    await narration.play();
  } catch {
    if (run === playbackRun) stopLine();
  }
});

const discover = byId('discover');
const introBubble = byId('intro-bubble');
const openNote = byId('open-note');

openNote.addEventListener('click', () => {
  stopLine();
  note.showModal();
  if (!musicEnabled) return;
  noteSound.volume = .7;
  noteSound.currentTime = 0;
  noteSound.play().catch(() => {});
});

function setStoryVisible(visible) {
  byId('intro').classList.toggle('splash', !visible);
  discover.hidden = visible;
  introBubble.hidden = !visible;
  openNote.hidden = !visible;
}

discover.addEventListener('click', () => {
  startSound();
  setStoryVisible(true);
  listen.focus({preventScroll:true});
  listen.click();
});
byId('restart').addEventListener('click', () => {
  stopLine();
  stopFinaleTrack();
  setStoryVisible(false);
});
