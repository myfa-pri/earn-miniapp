from pathlib import Path

base = Path('scripts/ledger_accounting_fix.py').read_text()
base = '\n'.join(line for line in base.splitlines() if line.strip() != 'PY' and not line.strip().startswith('node --check scripts/ledger_accounting_fix.py')) + '\n'
final = Path('scripts/ledger_final_patch.py').read_text()
final = final.replace("exec(Path('scripts/ledger_accounting_fix.py').read_text(), {})", "exec(compile(" + repr(base) + ", 'scripts/ledger_accounting_fix.py', 'exec'), {})", 1)
exec(compile(final, 'scripts/ledger_final_patch.py', 'exec'), {})
