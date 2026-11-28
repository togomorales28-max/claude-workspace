// Pruebas del cálculo: node tests/core.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { core, DEFAULT_CONFIG } = require('../cotizador.js');
const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
const item = (o) => ({ typeId: 'porton', a: 24, b: 10, qty: 1, designId: 'sencillo', desc: '', featOver: {}, ...o });

// Material: marco 2(24+10)=68 + 2 travesaños×24=48 → 116 ft × $3; barrotes ⌈288/5⌉−1 = 57 × 10 = 570 ft × $1.10; +10 %
let c = core.itemCalc(cfg, item());
assert.equal(c.parts[0].len, 116); assert.equal(c.parts[1].len, 570);
assert.ok(Math.abs(c.material - (116 * 3 + 570 * 1.1) * 1.1) < 1e-9);
// Mano de obra: ejemplo 10×24 = 2 personas × 1 día → mismo tamaño → 2 × $40
assert.deepEqual([c.labor.persons, c.labor.days, c.labor.cost], [2, 1, 80]);
// Total redondeado a múltiplos de 17
assert.equal(c.total, Math.ceil((c.material + 80) / 17) * 17);
assert.equal(c.total, 1156);

// Trabajo chico: 1 persona, mínimo $40
c = core.itemCalc(cfg, item({ a: 6, b: 4 }));
assert.equal(c.labor.persons, 1); assert.equal(c.labor.cost, 40);
assert.equal(c.total, 280, 'aplica el mínimo del portón');
assert.ok(c.minApplied);

// Trabajo grande: nunca más de 2 personas
c = core.itemCalc(cfg, item({ a: 40, b: 12 }));
assert.equal(c.labor.persons, 2); assert.equal(c.labor.days, 2); assert.equal(c.labor.cost, 160);

// Dificultad por descripción; «marco» no activa «arco»
c = core.itemCalc(cfg, item({ desc: 'con marco reforzado' }));
assert.equal(c.extraPct, 0);
c = core.itemCalc(cfg, item({ desc: 'Portón corredizo con ARCO y lanzas de forja' }));
assert.deepEqual(c.feats.map((f) => f.id).sort(), ['corredizo', 'curvas', 'forja']);
assert.equal(c.extraPct, 60);
// El cliente puede desmarcar
c = core.itemCalc(cfg, item({ desc: 'con arco', featOver: { curvas: false, motor: true } }));
assert.deepEqual(c.feats.map((f) => f.id), ['motor']);

// Rango y teléfono
const e = core.estimate(cfg, [item()]);
assert.equal(e.low, Math.floor(1156 * 0.85 / 17) * 17); assert.equal(e.high, Math.ceil(1156 * 1.15 / 17) * 17);
// Teléfono obligatorio con + y código de país
assert.equal(core.phoneOk('+1 602 555 0123'), true);
assert.equal(core.phoneOk('+52 (631) 302-9172'), true);
assert.equal(core.phoneOk('+1 0000000'), true, 'el ejemplo del dueño (+1 y 7 dígitos)');
assert.equal(core.phoneOk('602 555 0123'), false, 'sin + no se acepta');
assert.equal(core.phoneOk('+1 602'), false, 'muy corto');
assert.equal(core.phoneOk('+1 602 abc 0123'), false, 'con letras');
assert.equal(core.phoneOk(''), false);
assert.equal(core.intlPhone(cfg, '+1 (602) 555-0123'), '+16025550123');

// Cotización y mensaje
const q = core.buildQuote(cfg, [item({ desc: 'con arco', photo: true })], { name: ' Ana López ', phone: '+1 713 555 0199', via: 'whatsapp' });
assert.equal(q.name, 'Ana López'); assert.equal(q.items.length, 1); assert.ok(q.items[0].extraText.includes('curvas'));
const msg = core.ownerMessage(cfg, q);
assert.ok(msg.includes('WhatsApp: +17135550199'));
assert.ok(msg.includes('Abrir chat: https://wa.me/17135550199'));
assert.ok(/^\+[0-9]{8,15}$/.test(q.phone), 'el formato coincide con la regla de la base de datos');
assert.ok(msg.includes('Tiene foto'));
console.log('ok: todas las pruebas del cálculo pasaron');
