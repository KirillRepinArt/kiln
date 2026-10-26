"""`python -m server` runs Kiln's server; `python -m server --launch` is the launcher kiln.bat runs (server/launch.py)."""

import sys

if sys.argv[1:] == ["--launch"]:
    from .launch import launch

    sys.exit(launch())
else:
    from .main import main

    main()
