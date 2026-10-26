# 0007 · JSON files until one SQLite database

**Context.** Kiln keeps its queue, history, names and ids in JSON files in `data/`. That's readable and fine for
hundreds of pictures; the Library (v0.8) will index thousands, and several files can't change together atomically.

**Decision.** For now: JSON files, each written to a temporary file and then renamed into place (a crash never leaves
half a file). **To be replaced in v0.7b** by one SQLite database (`data/kiln.db`, WAL, `secure_delete`, a schema
version with one tested migration per change; the JSON files imported once) — SQLite is in Python's standard library.
Pictures stay plain PNG files in `outputs/`, each with its settings inside: your work is never locked in a database.

**Consequences.** Today: simple, readable, enough. Its limit is known and planned for.
