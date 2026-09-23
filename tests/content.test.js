const test = require('node:test');
const assert = require('node:assert/strict');

const { CURRICULUM, METRICS, getDay } = require('../server/learningContent');
const { DRILLS, getDrill } = require('../server/practiceContent');
const { validateEvaluation, wrapPcmAsWav } = require('../server/geminiService');

test('30 kunlik kontent to‘liq va noyob', () => {
  assert.equal(CURRICULUM.length, 30);
  assert.equal(new Set(CURRICULUM.map(day => day.day)).size, 30);
  for (const day of CURRICULUM) {
    assert.ok(day.title);
    assert.ok(day.prompt);
    assert.ok(day.narrationText.length > 100);
    assert.ok(day.activeMetricIds.length >= 3);
  }
});

test('mustaqil mashqlar barcha besh yo‘nalishni qamrab oladi va tekshiruvga ega', () => {
  assert.equal(DRILLS.length, 15);
  assert.equal(new Set(DRILLS.map(item => item.id)).size, DRILLS.length);
  assert.deepEqual(new Set(DRILLS.map(item => item.pillar)), new Set(['ravonlik', 'aniqlik', 'tuzilma', 'yetkazish', 'ishonch']));
  for (const drill of DRILLS) {
    assert.ok(drill.prompt && drill.method && drill.example && drill.check && drill.transfer);
    assert.ok(drill.minutes >= 3 && drill.minutes <= 5);
    assert.ok(getDay(drill.unlockDay));
    assert.equal(getDrill(drill.id), drill);
  }
});

test('Gemini tahlili faqat faol mezonlar bilan validatsiya qilinadi', () => {
  const lesson = getDay(4);
  const data = {
    transcript: 'Men bu fikrni jim pauza bilan aytdim.',
    wordCount: 8,
    wpm: 90,
    fillerCount: 0,
    longPauseCount: 1,
    restartCount: 0,
    parasiteWords: [],
    metricScores: lesson.activeMetricIds.map(metricId => ({ metricId, score: 7, evidence: METRICS[metricId].title })),
    strengths: ['Jim pauza ishlatildi', 'Fikr yakunlandi'],
    improvements: ['Tezlikni barqaror saqlash', 'Xulosani aniqroq aytish'],
    suggestedFocus: 'Jim pauzani saqlash',
    summary: 'Nutq tushunarli.'
  };
  const result = validateEvaluation(data, lesson, 60);
  assert.equal(result.totalScore, 70);
  assert.equal(result.metricScores.length, lesson.activeMetricIds.length);
  assert.equal(result.wordCount, 7);
  assert.equal(result.wpm, 7);
});

test('TTS PCM ma’lumoti yaroqli WAV sarlavhasi oladi', () => {
  const wav = wrapPcmAsWav(Buffer.alloc(480));
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.length, 524);
});
