import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * #304 — the root and every subpath entry must share one copy of TrustFlowError and the
 * escrow classes, in both CJS and ESM output. Builds into a temporary directory and runs
 * the same check CI runs against `dist/`.
 */
const root = path.resolve(__dirname, '..');

describe('built entries share module identity (#304)', () => {
  let outDir: string;

  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustflow-dist-'));
    execFileSync('npx', ['tsup', '--no-dts', '--out-dir', outDir], { cwd: root, stdio: 'pipe' });
  }, 180_000);

  afterAll(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('exposes identical classes and error identity across entries', () => {
    expect(() =>
      execFileSync('node', [path.join(root, 'scripts', 'check-dist-identity.js'), outDir], {
        cwd: root,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  }, 60_000);
});
