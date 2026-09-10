import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { GROUPS, makeExample, phaseRanking, shuffleParticipants, generateQualifying, seededRandom } from './rei-do-sol-model.mjs';
import { createReiDoSolDrawVideo } from './rei-do-sol-draw-video.mjs';
import { shareRankingImages } from '../src/features/rankingShare/rankingShareExport.mjs';

const initial = makeExample(20, 4, 'finished');
const shuffled = shuffleParticipants(initial, seededRandom(10));
const receipt = createReiDoSolDrawVideo(shuffled.players);
assert.deepEqual(receipt.sections[0].entries, shuffled.players);
assert.equal(receipt.modalityName, 'Rei do Sol');
assert.equal(receipt.kind, 'names');
assert.ok(receipt.headerLabel.includes('PRÉVIA LOCAL'));
assert.deepEqual(JSON.parse(JSON.stringify(receipt)), receipt, 'The result is persisted, not regenerated on reopening');
const recordedState = { ...shuffled, lastShuffleVideo: receipt, drawVideos: { qualifying: { old: receipt } } };
assert.deepEqual(generateQualifying(recordedState).lastShuffleVideo, receipt, 'Creating games keeps the original draw video');
assert.deepEqual(generateQualifying(recordedState).drawVideos, {}, 'New games invalidate old tiebreak videos');
assert.equal(shuffleParticipants(recordedState).lastShuffleVideo, null, 'A new draw cannot reuse an older receipt');
const tieNames = ['Nicolas Silva', 'Felipe Silva'];
const tieVideo = createReiDoSolDrawVideo(tieNames, 'lango');
assert.equal(tieVideo.sections[0].title, 'Desempate · Lango');
tieNames.reverse();
assert.deepEqual(tieVideo.sections[0].entries, ['Nicolas Silva', 'Felipe Silva'], 'Video keeps the actual winning order');

// Exercise the real platform image exporter, recording its canvas operations.
const canvases = [];
const previousDocument = globalThis.document;
const previousImage = globalThis.Image;
globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror()); } };
globalThis.document = { createElement(tag) {
  assert.equal(tag, 'canvas');
  const operations = { texts: [], gradients: [], fills: [] };
  const context = new Proxy({
    measureText: value => ({ width: String(value).length * 9 }),
    createLinearGradient() { const stops = []; operations.gradients.push(stops); return { addColorStop: (offset, color) => stops.push(color) }; },
    fillText(text, x, y) { operations.texts.push({ text, color: this.fillStyle, x, y }); },
    fill() { operations.fills.push(this.fillStyle); },
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  canvases.push(operations);
  return { getContext: () => context, toBlob: callback => callback(new Blob(['test png'], { type: 'image/png' })) };
} };
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: Table } = await server.ssrLoadModule('/scripts/ReiDoSolRankingTable.jsx');
  const qualification = phaseRanking(initial.players, initial.qualifying, initial.target, initial.draws.qualifying);
  const table = Table({ title: 'Classificatória', ranking: qualification, qualifying: true });
  const shareConfig = table.props.children[1].props.shareConfig;
  const rows = shareConfig.groups[0].rows;
  GROUPS.forEach((group, index) => {
    assert.ok(rows.slice(index * 4, index * 4 + 4).every(row => row.badge.label === group.name && row.badge.background === group.palette.tint));
  });
  assert.ok(rows.slice(16).every(row => !row.badge), 'Eliminated athletes have no group color');
  const pages = await shareRankingImages(shareConfig);
  assert.equal(pages.files.length, 2);
  GROUPS.forEach(group => {
    const badges = canvases.flatMap(canvas => canvas.texts).filter(item => item.text === group.name);
    assert.equal(badges.length, 4, `All ${group.name} badges survive pagination`);
    assert.ok(badges.every(item => item.color === group.palette.ink));
    assert.ok(canvases.some(canvas => canvas.fills.includes(group.palette.tint)));
  });
  for (const group of GROUPS) {
    await shareRankingImages({ title: 'Rei do Sol', presentation: 'podium', podiumVariant: 'parallel', podium: [{ name: `Campeão ${group.name}` }], podiumPalette: { ...group.palette, accent: group.color }, podiumHeadingLabel: `CAMPEÃO ${group.name}`, showPlayTime: false });
    const canvas = canvases.at(-1);
    assert.ok(canvas.gradients.some(stops => stops.join() === [group.palette.start, group.palette.end].join()), 'Avatar uses its group palette');
    assert.ok(canvas.gradients.some(stops => stops.join() === [group.palette.end, group.palette.start].join()), 'Podium step uses its group palette');
    assert.equal(canvas.texts.find(item => item.text === '♛').color, group.color);
    assert.equal(canvas.texts.find(item => item.text === '1').color, group.palette.ink);
  }
  await shareRankingImages({ presentation: 'podium', podiumVariant: 'parallel', podium: [{ name: 'Existing champion' }] });
  assert.ok(canvases.at(-1).gradients.some(stops => stops.join() === '#fde047,#f59e0b'), 'Existing modalities keep the default gold podium');
  await shareRankingImages({ groups: [{ title: 'Existing ranking', rows: [{ name: 'Ana' }] }] });
  assert.ok(canvases.at(-1).fills.includes('#fff4c2'), 'Existing rankings keep their default colors');
  assert.equal(GROUPS.find(group => group.id === 'lango').color, '#60a5fa');
  console.log('Draw receipts, persistence, four group colors, paginated images, podium palettes and legacy defaults passed.');
} finally {
  globalThis.document = previousDocument;
  globalThis.Image = previousImage;
  await server.close();
}
