import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const board = readFileSync('app/operations-board.tsx', 'utf8');
const panel = readFileSync('app/board-links-panel.tsx', 'utf8');
const sections = ['news', 'fatalities', 'romeoville', 'ifsi', 'nipsta'];
// Render the actual conditional JSX and links component, not copies of their visibility rules.
const edit = board.split('\n').find(line => line.includes('aria-label={`${isTrainingSource(rotation)'));
const links = board.split('\n').find(line => line.includes('<BoardSectionLinks section={boardLinks.settings.sections[rotation]}'));
assert.ok(edit && links);
const sectionComponent = panel.slice(panel.indexOf('export function BoardSectionLinks'), panel.indexOf('export default function BoardLinksEditor'));
const compiled = ts.transpileModule(`
  const styles = { links: 'department-links' }, linkStyles = { editButton: 'edit-links' };
  const isBoardLinkSection = id => ${JSON.stringify(sections)}.includes(id);
  const isTrainingSource = id => ['romeoville', 'ifsi', 'nipsta'].includes(id);
  const setTrainingEditor = () => {}, setLinkEditor = () => {};
  ${sectionComponent}
  export function Controls({ tvMode, boardLinks, rotation }) { return <>${edit.trim()}${links.trim()}</>; }
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(createRequire(import.meta.url), exports);
const settings = { sections: Object.fromEntries(sections.map(id => [id, { title: `Preview ${id}`, links: [{ id: 'preview', label: 'Preview department resource', url: 'https://example.invalid/' }] }])) };
const render = (tvMode, canEdit, rotation) => renderToStaticMarkup(React.createElement(exports.Controls, { tvMode, rotation, boardLinks: { settings, canEdit, confirmed: true } }));

test('TV mode omits edit/manage controls and Department links in every news/training rotation', () => {
  for (const rotation of sections) for (const canEdit of [true, false]) {
    assert.equal(render(true, canEdit, rotation), '', `${rotation}, canEdit=${canEdit}`);
  }
});

test('normal portal retains authorized editing and department links', () => {
  for (const rotation of sections) {
    const html = render(false, true, rotation);
    assert.match(html, /<button/);
    assert.match(html, /Edit links|Manage classes/);
    assert.match(html, /aria-label="Department links"/);
    assert.match(html, /Preview department resource/);
  }
});

test('normal portal members keep the links but cannot edit', () => {
  for (const rotation of sections) {
    const html = render(false, false, rotation);
    assert.doesNotMatch(html, /<button/);
    assert.match(html, /aria-label="Department links"/);
  }
});

test('TV content and rotation remain mounted, with no links added to equipment or duty', () => {
  for (const rotation of ['equipment', 'duty']) assert.equal(render(false, true, rotation), '');
  assert.match(board, /className="rotation-slide" hidden=\{rotation !== "news"\}/);
  assert.match(board, /className="rotation-slide" hidden=\{rotation !== "fatalities"\}/);
  assert.match(board, /<TrainingCourses provider=\{trainingProviders\[providerId\]\} today=\{today\}/);
});
