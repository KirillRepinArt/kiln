"""`python -m server` starts Kiln's server; `python -m server --seed-edge <profile>` is kiln.bat's helper."""

import sys

from .config import CFG
from .edge import seed_spellcheck
from .main import main

if len(sys.argv) == 3 and sys.argv[1] == "--seed-edge":
    seed_spellcheck(sys.argv[2], CFG.get("spellcheck") or [])
else:
    main()
