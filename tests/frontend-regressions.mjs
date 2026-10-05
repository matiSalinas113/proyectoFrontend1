import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const nodeRequire = createRequire(import.meta.url);

// Ejecuta componentes con respuestas simuladas, sin modificar API ni base de datos.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const component = (props) => props;
function load(file, mocks = {}, extra = {}, suffix = '') {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8') + suffix;
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const requireMock = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/components/') || name === 'lucide-react') {
      return new Proxy({}, { get: () => component });
    }
    return nodeRequire(name);
  };
  vm.runInNewContext(code, { exports, require: requireMock, URL, URLSearchParams, ...extra }, { filename: file });
  return exports;
}
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree !== 'object') return String(tree);
  return text(tree.props?.children);
}
function hooks(overrides = {}) {
  const states = [];
  let index = 0;
  const effects = [];
  return {
    react: {
      useState(initial) {
        const i = index++;
        if (!(i in states)) states[i] = i in overrides ? overrides[i] : typeof initial === 'function' ? initial() : initial;
        return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
      },
      useRef: (value) => ({ current: value }),
      useEffect: (fn) => effects.push(fn),
      useMemo: (fn) => fn(),
      useCallback: (fn) => fn,
    },
    render(fn) { index = 0; effects.length = 0; return fn(); },
    effects,
  };
}
const format = load('src/lib/format.ts');
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

test('etiquetas, redondeo y fechas académicas', () => {
  assert.equal(format.DAY_LABEL.lunes, 'Lunes');
  assert.equal(format.STATUS_LABEL.reprobada, 'Reprobada');
  assert.equal(format.grade(4.59), '4.6');
  assert.equal(format.grade(0), '0.0');
  assert.equal(format.grade(null), '—');
  assert.equal(format.date('2026-10-05T00:00:00Z'), new Date('2026-10-05').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
});

test('sábado conserva su propia columna', () => {
  const { WeekSchedule } = load('src/components/week-schedule.tsx', { '@/lib/format': format, '@/lib/cn': { cn: (...args) => args.filter(Boolean).join(' ') } });
  const slot = { subject: { code: 'MAT', name: 'Matemáticas' }, group: 1, startTime: '08:00', endTime: '10:00' };
  const cards = WeekSchedule({ byDay: { sabado: [slot] } }).props.children;
  assert.ok(!text(cards[4]).includes('Matemáticas'));
  assert.ok(text(cards[5]).includes('Matemáticas'));
});

test('401 de login muestra credenciales; 401 autenticado redirige', async () => {
  const window = { location: { href: '' } };
  const { api } = load('src/lib/api.ts', {}, { window, fetch: async () => ({ status: 401, ok: false, json: async () => ({ message: 'Credenciales invalidas' }) }) });
  await assert.rejects(api('/auth/login'), (e) => e.message === 'Credenciales invalidas');
  assert.equal(window.location.href, '');
  await assert.rejects(api('/users/me'), (e) => e.status === 401);
  assert.equal(window.location.href, '/login?expired=1');
});

test('proxy bloquea subrutas de otro rol y permite las propias', () => {
  const { proxy } = load('src/proxy.ts', {
    'next/server': { NextResponse: { redirect: (url) => url.pathname, next: () => 'allowed' } },
    '@/lib/session': { COOKIE: 'token', HOME: { estudiante: '/estudiante' }, decodeToken: () => ({ role: 'estudiante' }) },
  });
  const request = (pathname) => ({ nextUrl: { pathname, searchParams: new URLSearchParams() }, cookies: { get: () => ({ value: 'token' }) }, url: `http://localhost:3001${pathname}` });
  assert.equal(proxy(request('/admin/usuarios')), '/estudiante');
  assert.equal(proxy(request('/estudiante/notas')), 'allowed');
});

test('panel admin usa docentes y claves de estado correctas', async () => {
  const { default: page } = load('src/app/(app)/admin/page.tsx', { '@/lib/server': { apiGet: async () => ({ active: { students: 20, teachers: 3 }, currentPeriod: { enrollmentsByStatus: { activa: 7, aprobada: 4 } } }) } });
  const tree = await page();
  assert.equal(nodes(tree).find((n) => n.props?.label === 'Docentes activos').props.value, 3);
  assert.ok(nodes(tree).some((n) => n.type === 'li' && text(n) === 'Activas7'));
});

test('inicio estudiante filtra periodo y estado, y acepta nombre simple', async () => {
  const calls = [];
  const api = async (url) => {
    calls.push(url);
    if (url === '/users/me') return { name: 'Ana' };
    if (url === '/periods/current') return { _id: 'periodo', code: '2026-2', startDate: '2026-01-01', endDate: '2026-12-31' };
    return { meta: { total: 2 }, unread: 0 };
  };
  const { default: page } = load('src/app/(app)/estudiante/page.tsx', { '@/lib/server': { apiGet: api, apiGetOrNull: api } });
  const tree = await page();
  assert.ok(calls.includes('/enrollments/mine?limit=1&status=activa&period=periodo'));
  assert.ok(nodes(tree).some((n) => n.props?.title === 'Hola, Ana'));
});

test('notas calcula acumulado ponderado y 3.0 es aprobatoria', async () => {
  const enrollment = { _id: 'e', status: 'activa', subject: { code: 'MAT', name: 'Matemáticas' }, group: { _id: 'g', number: 1 }, period: { code: '2026-2' } };
  const apiGet = async (url) => ({ data: url.startsWith('/enrollments') ? [enrollment] : url.startsWith('/grades') ? [{ enrollment: { _id: 'e' }, evaluation: { _id: 'a' }, value: 3 }, { enrollment: { _id: 'e' }, evaluation: { _id: 'b' }, value: 5 }] : [{ _id: 'a', weight: 20 }, { _id: 'b', weight: 80 }] });
  const { default: page } = load('src/app/(app)/estudiante/notas/page.tsx', { '@/lib/server': { apiGet }, '@/lib/format': format, '@/lib/cn': { cn: (...args) => args.filter(Boolean).join(' ') } });
  const tree = await page();
  assert.ok(text(tree).includes('4.60'));
  assert.ok(nodes(tree).some((n) => n.type === 'td' && text(n) === '3.0' && n.props.className.includes('text-success-600')));
});

test('editar nombre habilita el botón', () => {
  const h = hooks();
  const { AccountForms } = load('src/app/(app)/cuenta/account-forms.tsx', { react: h.react, 'next/navigation': { useRouter: () => ({ refresh() {} }) }, '@/lib/api': { api() {}, ApiError } });
  const render = () => AccountForms({ name: 'Ana', email: 'ana@example.com', roleLabel: 'Estudiante' });
  let tree = h.render(render);
  assert.equal(nodes(tree).find((n) => n.props?.type === 'submit' && text(n) === 'Guardar nombre').props.disabled, true);
  nodes(tree).find((n) => n.props?.name === 'name').props.onChange({ target: { value: 'Ana María' } });
  tree = h.render(render);
  assert.equal(nodes(tree).find((n) => n.props?.type === 'submit' && text(n) === 'Guardar nombre').props.disabled, false);
});

test('cancelar una matrícula refresca la página', async () => {
  const h = hooks();
  let refreshed = 0;
  const { CancelButton } = load('src/app/(app)/estudiante/materias/cancel-button.tsx', { react: h.react, 'next/navigation': { useRouter: () => ({ refresh() { refreshed++; } }) }, '@/lib/api': { api: async () => ({}), ApiError } });
  const render = () => CancelButton({ id: 'e', name: 'Matemáticas' });
  h.render(render).props.onClick();
  await nodes(h.render(render)).find((n) => text(n) === 'Sí, cancelar').props.onClick();
  assert.equal(refreshed, 1);
});

test('filtros se envían también en página 2', async () => {
  const h = hooks({ 0: 2, 3: { active: 'false' } });
  let url;
  const { ResourceManager } = load('src/components/admin/resource-manager.tsx', { react: h.react, '@/lib/api': { api: async (value) => { url = value; return { data: [], meta: { totalPages: 1 } }; }, ApiError } }, { URLSearchParams });
  h.render(() => ResourceManager({ config: { endpoint: '/users', columns: [], fields: [] } }));
  h.effects[2]();
  await new Promise(setImmediate);
  assert.equal(new URLSearchParams(url.split('?')[1]).get('active'), 'false');
  assert.equal(new URLSearchParams(url.split('?')[1]).get('page'), '2');
});

test('formulario limpio no marca cambios y cambiar programa limpia prerrequisitos', async () => {
  const h = hooks();
  let dirty;
  let submitted;
  const config = { fields: [{ name: 'program', type: 'select', label: 'Programa', options: [] }, { name: 'prerequisites', type: 'multiselect', label: 'Prerrequisitos', optionsFrom: { endpoint: (v) => `/subjects?program=${v.program}`, label: (s) => s.name } }], initial: () => ({ program: 'A', prerequisites: ['materia-A'] }) };
  config.endpoint = '/subjects';
  config.toBody = (values) => values;
  const { RecordForm } = load('src/components/admin/resource-manager.tsx', { react: h.react, '@/lib/api': { api: async (_url, options) => { submitted = options?.body; return { data: [] }; }, ApiError } }, {}, '\nexport { RecordForm };');
  const render = () => RecordForm({ config, mode: 'edit', row: { _id: 'subject', program: 'A' }, lookups: {}, onDirty: (v) => { dirty = v; }, onClose() {}, onSaved() {} });
  let tree = h.render(render);
  h.effects[0]();
  assert.equal(dirty, false);
  nodes(tree).find((n) => n.props?.name === 'program').props.onChange({ target: { value: 'B' } });
  tree = h.render(render);
  h.effects[0]();
  assert.equal(dirty, true);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.program, 'B');
  assert.equal(submitted.prerequisites.length, 0);
});

test('planilla acepta coma y bloquea guardar/finalizar una nota vaciada', async () => {
  const sheet = { evaluations: [{ id: 'ev', name: 'Parcial', weight: 100 }], rows: [{ enrollment: 'e', student: { name: 'Ana' }, status: 'activa', grades: { ev: 3 }, evaluatedWeight: 100, accumulated: 3, readyToFinalize: true }], summary: { readyToFinalize: 1, planComplete: true, totalWeight: 100, students: 1 } };
  for (const draft of ['4,5', '']) {
    const h = hooks({ 0: sheet, 1: { 'e:ev': draft } });
    let submitted;
    const { GradeSheetPanel } = load('src/app/(app)/docente/grupos/[id]/grade-sheet-panel.tsx', {
      react: h.react, '@/lib/format': format, '@/lib/cn': { cn: (...args) => args.filter(Boolean).join(' ') },
      '@/lib/api': { ApiError, api: async (url, options) => { if (url === '/grades/bulk') { submitted = options.body; return { saved: 1, failed: [] }; } return sheet; } },
    });
    const tree = h.render(() => GradeSheetPanel({ groupId: 'g', readOnly: false }));
    const save = nodes(tree).find((n) => typeof n.props?.onClick === 'function' && text(n).startsWith(' Guardar'));
    assert.ok(save);
    if (draft) {
      assert.equal(save.props.disabled, false);
      await save.props.onClick();
      assert.equal(submitted.items[0].value, 4.5);
    } else {
      assert.equal(save.props.disabled, true);
      assert.equal(nodes(tree).find((n) => typeof n.props?.onClick === 'function' && text(n).includes('Finalizar grupo')).props.disabled, true);
      assert.ok(nodes(tree).find((n) => n.type === 'input').props['aria-invalid']);
    }
  }
});

test('grupos docente aplica el periodo actual y muestra matriculados/capacidad', async () => {
  const calls = [];
  const current = { _id: 'p', code: '2026-2', status: 'abierto' };
  const { default: page } = load('src/app/(app)/docente/grupos/page.tsx', {
    'next/link': { default: component }, './period-select': { PeriodSelect: component }, '@/lib/format': format, '@/lib/cn': { cn: () => '' },
    '@/lib/server': { apiGetOrNull: async () => current, apiGet: async (url) => { calls.push(url); return { data: url.startsWith('/periods') ? [current] : [{ _id: 'g', subject: { code: 'MAT', name: 'Matemáticas' }, number: 1, period: current, enrolled: 10, capacity: 30, active: true, schedule: [] }] }; } },
  });
  const tree = await page({ searchParams: Promise.resolve({}) });
  assert.ok(calls.includes('/groups/mine?limit=100&period=p'));
  assert.ok(text(tree).includes('10 / 30 estudiantes'));
});

test('horario distingue fallo de conexión de ausencia de periodo', async () => {
  const { default: page } = load('src/app/(app)/estudiante/horario/page.tsx', {
    '@/components/week-schedule': { WeekSchedule: component }, '@/lib/format': format,
    '@/lib/server': { ApiError, apiGet: async () => { throw new ApiError(502, 'No se pudo conectar'); } },
  });
  const tree = await page();
  assert.ok(text(tree).includes('No se pudo conectar'));
  assert.ok(!nodes(tree).some((n) => n.props?.title === 'No hay un periodo abierto'));
});
