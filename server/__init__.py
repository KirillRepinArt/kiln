"""Kiln's server: serves the page and runs a persistent queue of pictures against an image generator (Forge Neo).

Python 3.10+, standard library only. Run:   python -m server        then open http://127.0.0.1:7870
Settings: copy config.example.json to config.local.json and edit (that file is git-ignored).

The modules, from the bottom up (each one only uses the ones above it):
    config     settings, and where the program's files and your data live (Paths)
    images     PNG text chunks (the generation parameters inside a picture), image types
    durable    writing files so a crash can't empty them (temp file, flushed, swapped in)
    store      data/kiln.db: the job list, the numbers, the timings (SQLite; JSON of older versions imported once)
    naming     file names: a series and its next number, numbers never handed out twice
    timings    how long a job will take, from your own finished runs
    jobqueue   the job list: saved to data/queue.json, one lock, a revision the page polls against
    recyclebin the Windows Recycle Bin: send a file there, find one in it
    pictures   finished pictures on disk: delete with undo, rename, put back, thumbnails, open in Explorer
    backends/  the image generator behind an interface (base.py) + the Forge Neo adapter (forge.py)
    catalog    what the generator offers (checkpoints, LoRAs, upscalers), cached
    worker     takes the next job, has the backend render it, saves the picture
    lifecycle  is a Kiln window still open? stop when it closed and the queue is done
    page, web  the page (index.html + app/) and the HTTP API
    instance   one Kiln per data folder (a lock), a port of its own (data/instance.json), /api/hello
    main       puts it all together; __main__ is `python -m server`
    launch     `python -m server --launch` (kiln.bat): find or start the server, open Kiln's window
"""

from .config import CFG
from .main import main

__all__ = ["CFG", "main"]
